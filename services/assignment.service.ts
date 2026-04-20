import { addDays, differenceInCalendarDays, endOfWeek, startOfWeek } from "date-fns";
import {
  AssignmentStatus,
  DayOfWeek,
  Prisma,
  ResponseStatus,
  TimeSlot,
  VolunteerPosition
} from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { DAY_LABELS, TIME_SLOT_DEFINITIONS, TIME_SLOTS } from "@/lib/constants/domain";
import type {
  AdminDashboardStats,
  AssignmentDetailDto,
  AssignmentVolunteerDto,
  OpenSlotDto,
  VolunteerSummary,
  WeeklyScheduleCell,
  WeeklyScheduleMatrix
} from "@/types/domain";
import { AppError } from "@/services/errors";
import { getAppSettings } from "@/services/setting.service";
import { logNotification, resendConfirmationReminder, sendEmailNotification } from "@/services/notification.service";
import { safePercentage } from "@/lib/utils";
import { determineAssignmentStatus } from "@/services/assignment-engine";

const assignmentInclude = {
  scheduleWeek: true,
  preachingPoint: {
    include: {
      activeSlots: true
    }
  },
  volunteers: {
    include: {
      volunteer: {
        include: {
          user: true
        }
      }
    }
  },
  responses: true,
  activities: {
    include: {
      actorUser: true
    },
    orderBy: {
      createdAt: "desc"
    }
  }
} satisfies Prisma.AssignmentInclude;

function mapVolunteerSummary(record: {
  id: string;
  userId: string;
  transportationNotes: string | null;
  preferredAreas: string[];
  reliabilityScore: number;
  confirmationCount: number;
  declineCount: number;
  noResponseCount: number;
  active: boolean;
  temporaryUnavailable: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    active: boolean;
  };
}): VolunteerSummary {
  return {
    id: record.id,
    userId: record.userId,
    name: record.user.name,
    email: record.user.email,
    phone: record.user.phone,
    active: record.user.active && record.active,
    transportationNotes: record.transportationNotes,
    preferredAreas: record.preferredAreas,
    reliabilityScore: record.reliabilityScore,
    confirmationCount: record.confirmationCount,
    declineCount: record.declineCount,
    noResponseCount: record.noResponseCount,
    temporaryUnavailable: record.temporaryUnavailable
  };
}

function calculateWarnings(input: {
  volunteerCount: number;
  hasDecline: boolean;
  duplicateBooking?: boolean;
}): string[] {
  const warnings: string[] = [];

  if (input.volunteerCount < 2) warnings.push("Incomplete pair");
  if (input.hasDecline) warnings.push("Replacement required");
  if (input.duplicateBooking) warnings.push("Possible duplicate booking");

  return warnings;
}

function mapAssignmentDetail(assignment: Prisma.AssignmentGetPayload<{ include: typeof assignmentInclude }>): AssignmentDetailDto {
  const volunteers: AssignmentVolunteerDto[] = assignment.volunteers.map((slot) => {
    const response = assignment.responses.find(
      (item) => item.volunteerId === slot.volunteerId
    );

    return {
      volunteerId: slot.volunteerId,
      assignmentVolunteerId: slot.id,
      position: slot.position,
      isReplacement: slot.isReplacement,
      responseStatus: response?.responseStatus ?? "PENDING",
      respondedAt: response?.respondedAt ?? null,
      responseNote: response?.note ?? null,
      volunteer: mapVolunteerSummary(slot.volunteer)
    };
  });

  return {
    id: assignment.id,
    scheduleWeekId: assignment.scheduleWeekId,
    date: assignment.date,
    dayOfWeek: assignment.dayOfWeek,
    timeSlot: assignment.timeSlot,
    status: assignment.status,
    notes: assignment.notes,
    preachingPoint: {
      id: assignment.preachingPoint.id,
      name: assignment.preachingPoint.name,
      area: assignment.preachingPoint.area,
      notes: assignment.preachingPoint.notes,
      active: assignment.preachingPoint.active,
      activeSlots: assignment.preachingPoint.activeSlots.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        timeSlot: slot.timeSlot
      }))
    },
    volunteers,
    timeline: assignment.activities.map((activity) => ({
      id: activity.id,
      actionType: activity.actionType,
      createdAt: activity.createdAt,
      actorName: activity.actorUser?.name ?? null,
      metadata: activity.metadata as Record<string, unknown> | null
    })),
    warnings: calculateWarnings({
      volunteerCount: volunteers.length,
      hasDecline: volunteers.some((volunteer) => volunteer.responseStatus === "DECLINED")
    })
  };
}

async function assertNoVolunteerConflicts(input: {
  assignmentId?: string;
  date: Date;
  timeSlot: TimeSlot;
  volunteerIds: string[];
}) {
  if (!input.volunteerIds.length) return;

  const conflicts = await db.assignmentVolunteer.findMany({
    where: {
      volunteerId: { in: input.volunteerIds },
      assignment: {
        date: input.date,
        timeSlot: input.timeSlot,
        id: input.assignmentId ? { not: input.assignmentId } : undefined,
        status: { notIn: ["CANCELLED"] }
      }
    },
    include: {
      volunteer: { include: { user: true } },
      assignment: { include: { preachingPoint: true } }
    }
  });

  if (conflicts.length > 0) {
    const names = conflicts.map((conflict) => conflict.volunteer.user.name).join(", ");
    throw new AppError(`Double booking detected for ${names}.`, 409);
  }
}

async function syncResponses(input: {
  tx: Prisma.TransactionClient;
  assignmentId: string;
  volunteerIds: string[];
}) {
  const existingResponses = await input.tx.assignmentResponse.findMany({
    where: {
      assignmentId: input.assignmentId
    }
  });

  const removeIds = existingResponses
    .filter((response) => !input.volunteerIds.includes(response.volunteerId))
    .map((response) => response.id);

  if (removeIds.length) {
    await input.tx.assignmentResponse.deleteMany({
      where: {
        id: { in: removeIds }
      }
    });
  }

  for (const volunteerId of input.volunteerIds) {
    const existing = existingResponses.find((response) => response.volunteerId === volunteerId);

    if (!existing) {
      await input.tx.assignmentResponse.create({
        data: {
          assignmentId: input.assignmentId,
          volunteerId,
          responseStatus: "PENDING"
        }
      });
    }
  }
}

export async function recalculateAssignmentStatus(
  assignmentId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? db;
  const [assignment, settings] = await Promise.all([
    client.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        volunteers: true,
        responses: true
      }
    }),
    getAppSettings()
  ]);

  if (["COMPLETED", "CANCELLED"].includes(assignment.status)) {
    return assignment;
  }

  const nextStatus = determineAssignmentStatus({
    assignmentDate: assignment.date,
    volunteerCount: assignment.volunteers.length,
    responses: assignment.responses,
    confirmationLeadDays: settings.confirmationLeadDays
  });

  if (nextStatus !== assignment.status) {
    return client.assignment.update({
      where: { id: assignmentId },
      data: { status: nextStatus }
    });
  }

  return assignment;
}

export async function createWeeklyAssignment(input: {
  scheduleWeekId: string;
  date: Date;
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlot;
  preachingPointId: string;
  notes?: string;
  volunteers: Array<{ volunteerId: string; position: VolunteerPosition }>;
  actorUserId: string;
}) {
  const uniqueVolunteerIds = [...new Set(input.volunteers.map((volunteer) => volunteer.volunteerId))];
  await assertNoVolunteerConflicts({
    date: input.date,
    timeSlot: input.timeSlot,
    volunteerIds: uniqueVolunteerIds
  });

  const assignment = await db.$transaction(async (tx) => {
    const created = await tx.assignment.create({
      data: {
        scheduleWeekId: input.scheduleWeekId,
        date: input.date,
        dayOfWeek: input.dayOfWeek,
        timeSlot: input.timeSlot,
        preachingPointId: input.preachingPointId,
        notes: input.notes,
        status: "SCHEDULED"
      }
    });

    if (input.volunteers.length) {
      await tx.assignmentVolunteer.createMany({
        data: input.volunteers.map((volunteer) => ({
          assignmentId: created.id,
          volunteerId: volunteer.volunteerId,
          position: volunteer.position
        }))
      });

      await syncResponses({
        tx,
        assignmentId: created.id,
        volunteerIds: uniqueVolunteerIds
      });
    }

    await tx.assignmentActivity.create({
      data: {
        assignmentId: created.id,
        actorUserId: input.actorUserId,
        actionType: "ASSIGNED",
        metadata: {
          volunteers: uniqueVolunteerIds
        }
      }
    });

    await recalculateAssignmentStatus(created.id, tx);

    return tx.assignment.findUniqueOrThrow({
      where: { id: created.id },
      include: assignmentInclude
    });
  });

  return mapAssignmentDetail(assignment);
}

export async function updateAssignment(
  assignmentId: string,
  input: {
    date?: Date;
    dayOfWeek?: DayOfWeek;
    timeSlot?: TimeSlot;
    preachingPointId?: string;
    status?: AssignmentStatus;
    notes?: string | null;
    volunteers?: Array<{ volunteerId: string; position: VolunteerPosition }>;
    actorUserId: string;
  }
) {
  const current = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { volunteers: true }
  });

  const nextDate = input.date ?? current.date;
  const nextTimeSlot = input.timeSlot ?? current.timeSlot;
  const volunteerIds = input.volunteers?.map((item) => item.volunteerId) ?? current.volunteers.map((item) => item.volunteerId);

  await assertNoVolunteerConflicts({
    assignmentId,
    date: nextDate,
    timeSlot: nextTimeSlot,
    volunteerIds
  });

  const assignment = await db.$transaction(async (tx) => {
    const updated = await tx.assignment.update({
      where: { id: assignmentId },
      data: {
        date: input.date,
        dayOfWeek: input.dayOfWeek,
        timeSlot: input.timeSlot,
        preachingPointId: input.preachingPointId,
        notes: input.notes,
        status: input.status
      }
    });

    if (input.volunteers) {
      await tx.assignmentVolunteer.deleteMany({ where: { assignmentId } });
      if (input.volunteers.length) {
        await tx.assignmentVolunteer.createMany({
          data: input.volunteers.map((volunteer) => ({
            assignmentId,
            volunteerId: volunteer.volunteerId,
            position: volunteer.position
          }))
        });
      }
      await syncResponses({
        tx,
        assignmentId,
        volunteerIds
      });
    }

    await tx.assignmentActivity.create({
      data: {
        assignmentId,
        actorUserId: input.actorUserId,
        actionType: "STATUS_OVERRIDDEN",
        metadata: {
          updatedFields: Object.keys(input)
        }
      }
    });

    await recalculateAssignmentStatus(assignmentId, tx);

    return tx.assignment.findUniqueOrThrow({
      where: { id: updated.id },
      include: assignmentInclude
    });
  });

  return mapAssignmentDetail(assignment);
}

export async function deleteAssignment(assignmentId: string) {
  await db.assignment.delete({ where: { id: assignmentId } });
}

export async function getAssignmentDetail(assignmentId: string) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: assignmentInclude
  });

  return mapAssignmentDetail(assignment);
}

export async function getWeeklySchedule(input?: {
  weekStart?: Date;
  filters?: {
    day?: DayOfWeek;
    pointId?: string;
    status?: AssignmentStatus;
  };
}): Promise<WeeklyScheduleMatrix> {
  const weekStart = input?.weekStart
    ? startOfWeek(input.weekStart, { weekStartsOn: 1 })
    : startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const assignments = await db.assignment.findMany({
    where: {
      date: {
        gte: weekStart,
        lte: weekEnd
      },
      dayOfWeek: input?.filters?.day,
      preachingPointId: input?.filters?.pointId,
      status: input?.filters?.status
    },
    include: {
      preachingPoint: true,
      volunteers: {
        include: {
          volunteer: {
            include: { user: true }
          }
        }
      },
      responses: true
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }]
  });

  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = addDays(weekStart, index);
    const dayOfWeek = Object.keys(DAY_LABELS)[index] as DayOfWeek;
    const items = TIME_SLOTS.reduce(
      (accumulator, timeSlot) => {
        accumulator[timeSlot] = [];
        return accumulator;
      },
      {} as Record<TimeSlot, WeeklyScheduleCell[]>
    );

    return {
      date,
      dayOfWeek,
      items
    };
  });

  for (const assignment of assignments) {
    const day = days.find((item) => item.dayOfWeek === assignment.dayOfWeek);
    if (!day) continue;

    day.items[assignment.timeSlot].push({
      id: assignment.id,
      date: assignment.date,
      dayOfWeek: assignment.dayOfWeek,
      timeSlot: assignment.timeSlot,
      preachingPointId: assignment.preachingPointId,
      preachingPointName: assignment.preachingPoint.name,
      area: assignment.preachingPoint.area,
      status: assignment.status,
      volunteerNames: assignment.volunteers.map((slot) => slot.volunteer.user.name),
      warnings: calculateWarnings({
        volunteerCount: assignment.volunteers.length,
        hasDecline: assignment.responses.some(
          (response) => response.responseStatus === "DECLINED"
        )
      })
    });
  }

  return {
    weekLabel: `Week of ${weekStart.toLocaleDateString()}`,
    startDate: weekStart,
    endDate: weekEnd,
    days
  };
}

export async function duplicateScheduleWeek(input: {
  sourceWeekId: string;
  targetWeekStart: Date;
  actorUserId: string;
}) {
  const sourceWeek = await db.scheduleWeek.findUniqueOrThrow({
    where: { id: input.sourceWeekId },
    include: {
      assignments: {
        include: {
          volunteers: true,
          responses: true
        }
      }
    }
  });

  const targetWeek = await db.scheduleWeek.create({
    data: {
      startDate: input.targetWeekStart,
      endDate: addDays(input.targetWeekStart, 6),
      label: `Week of ${input.targetWeekStart.toLocaleDateString()}`,
      createdById: input.actorUserId
    }
  });

  for (const assignment of sourceWeek.assignments) {
    const newDate = addDays(input.targetWeekStart, differenceInCalendarDays(assignment.date, sourceWeek.startDate));
    await createWeeklyAssignment({
      scheduleWeekId: targetWeek.id,
      date: newDate,
      dayOfWeek: assignment.dayOfWeek,
      timeSlot: assignment.timeSlot,
      preachingPointId: assignment.preachingPointId,
      notes: assignment.notes ?? undefined,
      volunteers: assignment.volunteers.map((volunteer) => ({
        volunteerId: volunteer.volunteerId,
        position: volunteer.position
      })),
      actorUserId: input.actorUserId
    });
  }

  return targetWeek;
}

export async function confirmAssignment(input: {
  assignmentId: string;
  volunteerProfileId: string;
  note?: string;
}) {
  const assignment = await db.$transaction(async (tx) => {
    await tx.assignmentResponse.upsert({
      where: {
        assignmentId_volunteerId: {
          assignmentId: input.assignmentId,
          volunteerId: input.volunteerProfileId
        }
      },
      update: {
        responseStatus: "CONFIRMED",
        note: input.note,
        respondedAt: new Date()
      },
      create: {
        assignmentId: input.assignmentId,
        volunteerId: input.volunteerProfileId,
        responseStatus: "CONFIRMED",
        note: input.note,
        respondedAt: new Date()
      }
    });

    await tx.assignmentActivity.create({
      data: {
        assignmentId: input.assignmentId,
        actionType: "RESPONSE_RECEIVED",
        metadata: {
          volunteerProfileId: input.volunteerProfileId,
          responseStatus: "CONFIRMED",
          note: input.note
        }
      }
    });

    await recalculateAssignmentStatus(input.assignmentId, tx);

    await tx.volunteerProfile.update({
      where: { id: input.volunteerProfileId },
      data: {
        confirmationCount: {
          increment: 1
        }
      }
    });

    return tx.assignment.findUniqueOrThrow({
      where: { id: input.assignmentId },
      include: assignmentInclude
    });
  });

  return mapAssignmentDetail(assignment);
}

export async function declineAssignment(input: {
  assignmentId: string;
  volunteerProfileId: string;
  note?: string;
}) {
  const assignment = await db.$transaction(async (tx) => {
    await tx.assignmentResponse.upsert({
      where: {
        assignmentId_volunteerId: {
          assignmentId: input.assignmentId,
          volunteerId: input.volunteerProfileId
        }
      },
      update: {
        responseStatus: "DECLINED",
        note: input.note,
        respondedAt: new Date()
      },
      create: {
        assignmentId: input.assignmentId,
        volunteerId: input.volunteerProfileId,
        responseStatus: "DECLINED",
        note: input.note,
        respondedAt: new Date()
      }
    });

    await tx.assignment.update({
      where: { id: input.assignmentId },
      data: { status: "NEEDS_REPLACEMENT" }
    });

    await tx.assignmentActivity.create({
      data: {
        assignmentId: input.assignmentId,
        actionType: "RESPONSE_RECEIVED",
        metadata: {
          volunteerProfileId: input.volunteerProfileId,
          responseStatus: "DECLINED",
          note: input.note
        }
      }
    });

    await tx.volunteerProfile.update({
      where: { id: input.volunteerProfileId },
      data: {
        declineCount: {
          increment: 1
        }
      }
    });

    return tx.assignment.findUniqueOrThrow({
      where: { id: input.assignmentId },
      include: assignmentInclude
    });
  });

  return mapAssignmentDetail(assignment);
}

export async function getAvailableVolunteersForSlot(input: {
  date: Date;
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlot;
  area?: string;
  excludeVolunteerIds?: string[];
}) {
  const volunteers = await db.volunteerProfile.findMany({
    where: {
      active: true,
      temporaryUnavailable: false,
      user: { active: true },
      id: {
        notIn: input.excludeVolunteerIds ?? []
      },
      availability: {
        some: {
          dayOfWeek: input.dayOfWeek,
          timeSlot: input.timeSlot,
          available: true
        }
      },
      assignments: {
        none: {
          assignment: {
            date: input.date,
            timeSlot: input.timeSlot,
            status: {
              notIn: ["CANCELLED"]
            }
          }
        }
      },
      availabilityBlocks: {
        none: {
          startDate: { lte: input.date },
          endDate: { gte: input.date }
        }
      }
    },
    include: {
      user: true
    },
    orderBy: [{ reliabilityScore: "desc" }, { user: { name: "asc" } }],
    take: 6
  });

  const mapped = volunteers.map(mapVolunteerSummary);
  if (!input.area) return mapped;
  const area = input.area;

  return mapped.sort((a, b) => {
    const aMatch = a.preferredAreas.includes(area) ? 1 : 0;
    const bMatch = b.preferredAreas.includes(area) ? 1 : 0;
    return bMatch - aMatch || b.reliabilityScore - a.reliabilityScore;
  });
}

export async function getOpenSlots(): Promise<OpenSlotDto[]> {
  const assignments = await db.assignment.findMany({
    where: {
      OR: [{ status: "NEEDS_REPLACEMENT" }, { volunteers: { some: {} } }],
      NOT: {
        status: "CANCELLED"
      }
    },
    include: {
      preachingPoint: true,
      volunteers: true,
      responses: true
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }]
  });

  const results = await Promise.all(
    assignments
      .filter((assignment) => assignment.status === "NEEDS_REPLACEMENT" || assignment.volunteers.length < 2)
      .map(async (assignment) => {
        const missingPositions = (["FIRST", "SECOND"] as VolunteerPosition[]).filter(
          (position) => !assignment.volunteers.some((slot) => slot.position === position)
        );
        const declinedPositions = assignment.responses
          .filter((response) => response.responseStatus === "DECLINED")
          .map((response) => {
            const slot = assignment.volunteers.find(
              (volunteer) => volunteer.volunteerId === response.volunteerId
            );
            return slot?.position;
          })
          .filter(Boolean) as VolunteerPosition[];

        const positions = [...new Set([...missingPositions, ...declinedPositions])];
        const suggestions = await getAvailableVolunteersForSlot({
          date: assignment.date,
          dayOfWeek: assignment.dayOfWeek,
          timeSlot: assignment.timeSlot,
          area: assignment.preachingPoint.area,
          excludeVolunteerIds: assignment.volunteers.map((item) => item.volunteerId)
        });

        return {
          assignmentId: assignment.id,
          date: assignment.date,
          dayOfWeek: assignment.dayOfWeek,
          timeSlot: assignment.timeSlot,
          preachingPointId: assignment.preachingPointId,
          preachingPointName: assignment.preachingPoint.name,
          area: assignment.preachingPoint.area,
          status: assignment.status,
          missingPositions: positions.length ? positions : ["SECOND"],
          urgencyLabel:
            differenceInCalendarDays(assignment.date, new Date()) <= 2
              ? "Urgent"
              : "Open slot",
          suggestedVolunteers: suggestions,
          notes: assignment.notes
        } satisfies OpenSlotDto;
      })
  );

  return results;
}

export async function assignReplacementVolunteer(input: {
  assignmentId: string;
  volunteerId: string;
  actorUserId: string;
  position?: VolunteerPosition;
}) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: input.assignmentId },
    include: {
      volunteers: true,
      preachingPoint: true
    }
  });

  await assertNoVolunteerConflicts({
    assignmentId: input.assignmentId,
    date: assignment.date,
    timeSlot: assignment.timeSlot,
    volunteerIds: [input.volunteerId]
  });

  const targetPosition =
    input.position ??
    (["FIRST", "SECOND"] as VolunteerPosition[]).find(
      (position) => !assignment.volunteers.some((slot) => slot.position === position)
    ) ??
    assignment.volunteers[assignment.volunteers.length - 1]?.position;

  if (!targetPosition) {
    throw new AppError("No available volunteer slot found.", 400);
  }

  const result = await db.$transaction(async (tx) => {
    const existingPosition = assignment.volunteers.find(
      (slot) => slot.position === targetPosition
    );

    if (existingPosition) {
      await tx.assignmentVolunteer.delete({
        where: { id: existingPosition.id }
      });
      await tx.assignmentResponse.deleteMany({
        where: {
          assignmentId: input.assignmentId,
          volunteerId: existingPosition.volunteerId
        }
      });
    }

    await tx.assignmentVolunteer.create({
      data: {
        assignmentId: input.assignmentId,
        volunteerId: input.volunteerId,
        position: targetPosition,
        isReplacement: true
      }
    });

    await syncResponses({
      tx,
      assignmentId: input.assignmentId,
      volunteerIds: [
        ...assignment.volunteers
          .filter((slot) => slot.position !== targetPosition)
          .map((slot) => slot.volunteerId),
        input.volunteerId
      ]
    });

    await tx.assignment.update({
      where: { id: input.assignmentId },
      data: {
        status: "REASSIGNED"
      }
    });

    await tx.assignmentActivity.create({
      data: {
        assignmentId: input.assignmentId,
        actorUserId: input.actorUserId,
        actionType: "REPLACEMENT_ASSIGNED",
        metadata: {
          volunteerId: input.volunteerId,
          position: targetPosition
        }
      }
    });

    await recalculateAssignmentStatus(input.assignmentId, tx);

    return tx.assignment.findUniqueOrThrow({
      where: { id: input.assignmentId },
      include: assignmentInclude
    });
  });

  return mapAssignmentDetail(result);
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const schedule = await getWeeklySchedule();
  const [assignments, openSlots] = await Promise.all([
    db.assignment.findMany({
      where: {
        date: {
          gte: schedule.startDate,
          lte: schedule.endDate
        }
      },
      include: assignmentInclude
    }),
    getOpenSlots()
  ]);

  const details = assignments.map(mapAssignmentDetail);
  const today = new Date();
  const todaysAssignments = schedule.days.find(
    (day) => day.date.toDateString() === today.toDateString()
  );

  return {
    weekLabel: schedule.weekLabel,
    stats: {
      totalAssignments: assignments.length,
      confirmedAssignments: assignments.filter((item) => item.status === "CONFIRMED").length,
      pendingConfirmations: assignments.filter(
        (item) => item.status === "PENDING_CONFIRMATION"
      ).length,
      declinedAssignments: assignments.filter((item) => item.status === "DECLINED").length,
      openSlots: openSlots.length
    },
    todaysAssignments: todaysAssignments ? Object.values(todaysAssignments.items).flat() : [],
    pendingConfirmations: details.filter(
      (assignment) => assignment.status === "PENDING_CONFIRMATION"
    ),
    urgentReplacements: openSlots.filter((slot) => slot.urgencyLabel === "Urgent")
  };
}

export async function getVolunteerHistory(volunteerProfileId: string) {
  const assignments = await db.assignment.findMany({
    where: {
      volunteers: {
        some: {
          volunteerId: volunteerProfileId
        }
      }
    },
    include: assignmentInclude,
    orderBy: { date: "desc" }
  });

  return assignments.map(mapAssignmentDetail);
}

export async function sendAssignmentConfirmationRequests(assignmentId: string) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      preachingPoint: true,
      volunteers: {
        include: {
          volunteer: {
            include: { user: true }
          }
        }
      }
    }
  });

  await Promise.all(
    assignment.volunteers.map(async (slot) => {
      await sendEmailNotification({
        userId: slot.volunteer.userId,
        assignmentId,
        type: "CONFIRMATION_REQUEST",
        subject: "Please confirm your PPAM assignment",
        html: `<p>Hello ${slot.volunteer.user.name},</p><p>You are assigned to ${assignment.preachingPoint.name} on ${DAY_LABELS[assignment.dayOfWeek]} at ${TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}.</p>`,
        metadata: {
          pointName: assignment.preachingPoint.name
        }
      });
      await db.assignmentActivity.create({
        data: {
          assignmentId,
          actionType: "REMINDER_SENT",
          metadata: {
            volunteerProfileId: slot.volunteerId
          }
        }
      });
    })
  );
}

export async function resendAssignmentConfirmation(assignmentId: string) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      preachingPoint: true,
      volunteers: {
        include: {
          volunteer: {
            include: { user: true }
          }
        }
      }
    }
  });

  await Promise.all(
    assignment.volunteers.map((slot) =>
      resendConfirmationReminder({
        assignmentId,
        volunteerUserId: slot.volunteer.userId,
        volunteerName: slot.volunteer.user.name,
        pointName: assignment.preachingPoint.name,
        dateLabel: DAY_LABELS[assignment.dayOfWeek],
        timeSlotLabel: TIME_SLOT_DEFINITIONS[assignment.timeSlot].label
      })
    )
  );
}

export async function getAssignmentHealthSummary() {
  const assignments = await db.assignment.findMany({
    include: {
      volunteers: true,
      responses: true
    }
  });

  const confirmedAssignments = assignments.filter(
    (assignment) => assignment.status === "CONFIRMED"
  ).length;
  const openSlotAssignments = assignments.filter(
    (assignment) =>
      assignment.status === "NEEDS_REPLACEMENT" || assignment.volunteers.length < 2
  ).length;

  return {
    totalAssignments: assignments.length,
    confirmationRate: safePercentage(confirmedAssignments, assignments.length),
    openSlotRate: safePercentage(openSlotAssignments, assignments.length)
  };
}

export async function getAssignments(input?: {
  volunteerId?: string;
  pointId?: string;
  date?: string;
  status?: AssignmentStatus;
  search?: string;
}) {
  const assignments = await db.assignment.findMany({
    where: {
      preachingPointId: input?.pointId,
      status: input?.status,
      date: input?.date ? new Date(input.date) : undefined,
      volunteers: input?.volunteerId
        ? {
            some: {
              volunteerId: input.volunteerId
            }
          }
        : undefined,
      OR: input?.search
        ? [
            {
              preachingPoint: {
                name: { contains: input.search, mode: "insensitive" }
              }
            },
            {
              volunteers: {
                some: {
                  volunteer: {
                    user: {
                      name: { contains: input.search, mode: "insensitive" }
                    }
                  }
                }
              }
            }
          ]
        : undefined
    },
    include: assignmentInclude,
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }]
  });

  return assignments.map(mapAssignmentDetail);
}
