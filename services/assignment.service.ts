import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  isSameDay,
  startOfWeek
} from "date-fns";
import {
  AssignmentStatus,
  DayOfWeek,
  Prisma,
  ResponseStatus,
  TimeSlot,
  VolunteerPosition
} from "@prisma/client";

import { db } from "@/lib/db/prisma";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS,
  TIME_SLOTS
} from "@/lib/constants/domain";
import type {
  AdminDashboardStats,
  AssignmentDetailDto,
  AssignmentVolunteerDto,
  OpenSlotDto,
  VolunteerSummary,
  WeeklySchedulePointCell,
  WeeklyScheduleMatrix
} from "@/types/domain";
import { AppError } from "@/services/errors";
import { getAppSettings } from "@/services/setting.service";
import {
  resendConfirmationReminder,
  sendEmailNotification
} from "@/services/notification.service";
import { getAppBaseUrl } from "@/lib/env/config";
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

  if (input.volunteerCount < 2) warnings.push("Pareja incompleta");
  if (input.hasDecline) warnings.push("Se requiere reemplazo");
  if (input.duplicateBooking) warnings.push("Posible asignación duplicada");

  return warnings;
}

function mapAssignmentDetail(
  assignment: Prisma.AssignmentGetPayload<{ include: typeof assignmentInclude }>
): AssignmentDetailDto {
  const volunteers: AssignmentVolunteerDto[] = assignment.volunteers.map(
    (slot) => {
      const response = assignment.responses.find(
        (item) => item.volunteerId === slot.volunteerId
      );

      return {
        volunteerId: slot.volunteerId,
        assignmentVolunteerId: slot.id,
        responseId: response?.id ?? null,
        position: slot.position,
        isReplacement: slot.isReplacement,
        responseStatus: response?.responseStatus ?? "PENDING",
        respondedAt: response?.respondedAt ?? null,
        responseNote: response?.note ?? null,
        volunteer: mapVolunteerSummary(slot.volunteer)
      };
    }
  );

  return {
    id: assignment.id,
    scheduleWeekId: assignment.scheduleWeekId,
    date: assignment.date,
    dayOfWeek: assignment.dayOfWeek,
    timeSlot: assignment.timeSlot,
    pairNumber: assignment.pairNumber,
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
      hasDecline: volunteers.some(
        (volunteer) => volunteer.responseStatus === "DECLINED"
      )
    })
  };
}

function normalizeWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

async function assertWeekDoesNotExist(startDate: Date) {
  const endDate = addDays(startDate, 6);
  const existingWeek = await db.scheduleWeek.findUnique({
    where: {
      startDate_endDate: {
        startDate,
        endDate
      }
    }
  });

  if (existingWeek) {
    throw new AppError(
      `Ya existe una semana creada para el ${startDate.toLocaleDateString("es-MX")}.`,
      409
    );
  }
}

async function assertPointSupportsSlot(input: {
  preachingPointId: string;
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlot;
}) {
  const point = await db.preachingPoint.findUniqueOrThrow({
    where: { id: input.preachingPointId },
    include: {
      activeSlots: true
    }
  });

  if (!point.activeSlots.length) {
    return;
  }

  const isAllowed = point.activeSlots.some(
    (slot) =>
      slot.dayOfWeek === input.dayOfWeek && slot.timeSlot === input.timeSlot
  );

  if (!isAllowed) {
    throw new AppError(
      `El punto ${point.name} no está habilitado para ${DAY_LABELS[input.dayOfWeek]} en ${TIME_SLOT_DEFINITIONS[input.timeSlot].label}.`,
      409
    );
  }
}

function buildConfirmationLink(responseId: string) {
  return `${getAppBaseUrl()}/volunteer/confirm/${responseId}`;
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
    const names = conflicts
      .map((conflict) => conflict.volunteer.user.name)
      .join(", ");
    throw new AppError(`Se detectó doble asignación para ${names}.`, 409);
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
    const existing = existingResponses.find(
      (response) => response.volunteerId === volunteerId
    );

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

async function getNextPairNumber(input: {
  tx: Prisma.TransactionClient;
  date: Date;
  timeSlot: TimeSlot;
  preachingPointId: string;
}) {
  const result = await input.tx.assignment.aggregate({
    where: {
      date: input.date,
      timeSlot: input.timeSlot,
      preachingPointId: input.preachingPointId
    },
    _max: {
      pairNumber: true
    }
  });

  return (result._max.pairNumber ?? 0) + 1;
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
  pairNumber?: number;
  notes?: string;
  volunteers: Array<{ volunteerId: string; position: VolunteerPosition }>;
  actorUserId: string;
}) {
  await assertPointSupportsSlot({
    preachingPointId: input.preachingPointId,
    dayOfWeek: input.dayOfWeek,
    timeSlot: input.timeSlot
  });

  const uniqueVolunteerIds = [
    ...new Set(input.volunteers.map((volunteer) => volunteer.volunteerId))
  ];
  await assertNoVolunteerConflicts({
    date: input.date,
    timeSlot: input.timeSlot,
    volunteerIds: uniqueVolunteerIds
  });

  const assignment = await db.$transaction(async (tx) => {
    const pairNumber =
      input.pairNumber ??
      (await getNextPairNumber({
        tx,
        date: input.date,
        timeSlot: input.timeSlot,
        preachingPointId: input.preachingPointId
      }));

    const created = await tx.assignment.create({
      data: {
        scheduleWeekId: input.scheduleWeekId,
        date: input.date,
        dayOfWeek: input.dayOfWeek,
        timeSlot: input.timeSlot,
        preachingPointId: input.preachingPointId,
        pairNumber,
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
  const nextDayOfWeek = input.dayOfWeek ?? current.dayOfWeek;
  const nextTimeSlot = input.timeSlot ?? current.timeSlot;
  const nextPreachingPointId =
    input.preachingPointId ?? current.preachingPointId;
  const volunteerIds =
    input.volunteers?.map((item) => item.volunteerId) ??
    current.volunteers.map((item) => item.volunteerId);
  const movedToNewSlot =
    !isSameDay(nextDate, current.date) ||
    nextTimeSlot !== current.timeSlot ||
    nextPreachingPointId !== current.preachingPointId;

  await assertPointSupportsSlot({
    preachingPointId: nextPreachingPointId,
    dayOfWeek: nextDayOfWeek,
    timeSlot: nextTimeSlot
  });

  await assertNoVolunteerConflicts({
    assignmentId,
    date: nextDate,
    timeSlot: nextTimeSlot,
    volunteerIds
  });

  const assignment = await db.$transaction(async (tx) => {
    const pairNumber = movedToNewSlot
      ? await getNextPairNumber({
          tx,
          date: nextDate,
          timeSlot: nextTimeSlot,
          preachingPointId: nextPreachingPointId
        })
      : current.pairNumber;

    const updated = await tx.assignment.update({
      where: { id: assignmentId },
      data: {
        date: input.date,
        dayOfWeek: input.dayOfWeek,
        timeSlot: input.timeSlot,
        preachingPointId: input.preachingPointId,
        pairNumber,
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

export async function getAssignmentsForScheduleSlot(input: {
  date: Date;
  timeSlot: TimeSlot;
}) {
  const assignments = await db.assignment.findMany({
    where: {
      date: input.date,
      timeSlot: input.timeSlot
    },
    include: assignmentInclude,
    orderBy: [{ preachingPoint: { name: "asc" } }, { pairNumber: "asc" }]
  });

  return assignments.map(mapAssignmentDetail);
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
    orderBy: [
      { date: "asc" },
      { timeSlot: "asc" },
      { preachingPoint: { name: "asc" } },
      { pairNumber: "asc" }
    ]
  });

  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = addDays(weekStart, index);
    const dayOfWeek = DAYS_OF_WEEK[index];
    const items = TIME_SLOTS.reduce(
      (accumulator, timeSlot) => {
        accumulator[timeSlot] = [];
        return accumulator;
      },
      {} as Record<TimeSlot, WeeklySchedulePointCell[]>
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

    const groups = day.items[assignment.timeSlot];
    const existingGroup = groups.find(
      (group) => group.preachingPointId === assignment.preachingPointId
    );

    const pair = {
      id: assignment.id,
      pairNumber: assignment.pairNumber,
      status: assignment.status,
      volunteerNames: assignment.volunteers.map(
        (slot) => slot.volunteer.user.name
      ),
      warnings: calculateWarnings({
        volunteerCount: assignment.volunteers.length,
        hasDecline: assignment.responses.some(
          (response) => response.responseStatus === "DECLINED"
        )
      }),
      notes: assignment.notes
    };

    if (existingGroup) {
      existingGroup.pairs.push(pair);
      existingGroup.pairs.sort(
        (left, right) => left.pairNumber - right.pairNumber
      );
      continue;
    }

    groups.push({
      date: assignment.date,
      dayOfWeek: assignment.dayOfWeek,
      timeSlot: assignment.timeSlot,
      preachingPointId: assignment.preachingPointId,
      preachingPointName: assignment.preachingPoint.name,
      area: assignment.preachingPoint.area,
      pairs: [pair]
    });
  }

  return {
    weekLabel: `Semana del ${weekStart.toLocaleDateString("es-MX")}`,
    startDate: weekStart,
    endDate: weekEnd,
    days
  };
}

export async function createScheduleWeek(input: {
  targetWeekStart: Date;
  actorUserId: string;
}) {
  const weekStart = normalizeWeekStart(input.targetWeekStart);
  await assertWeekDoesNotExist(weekStart);

  return db.scheduleWeek.create({
    data: {
      startDate: weekStart,
      endDate: addDays(weekStart, 6),
      label: `Semana del ${weekStart.toLocaleDateString("es-MX")}`,
      createdById: input.actorUserId
    }
  });
}

export async function duplicateScheduleWeek(input: {
  sourceWeekId: string;
  targetWeekStart: Date;
  actorUserId: string;
}) {
  const weekStart = normalizeWeekStart(input.targetWeekStart);
  await assertWeekDoesNotExist(weekStart);

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
      startDate: weekStart,
      endDate: addDays(weekStart, 6),
      label: `Semana del ${weekStart.toLocaleDateString("es-MX")}`,
      createdById: input.actorUserId
    }
  });

  for (const assignment of sourceWeek.assignments) {
    const newDate = addDays(
      weekStart,
      differenceInCalendarDays(assignment.date, sourceWeek.startDate)
    );
    await createWeeklyAssignment({
      scheduleWeekId: targetWeek.id,
      date: newDate,
      dayOfWeek: assignment.dayOfWeek,
      timeSlot: assignment.timeSlot,
      preachingPointId: assignment.preachingPointId,
      pairNumber: assignment.pairNumber,
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

async function getAssignmentResponseContext(responseId: string) {
  const response = await db.assignmentResponse.findUnique({
    where: { id: responseId }
  });

  if (!response) {
    throw new AppError("No se encontró la solicitud de confirmación.", 404);
  }

  return response;
}

export async function confirmAssignmentResponseById(input: {
  responseId: string;
  note?: string;
}) {
  const response = await getAssignmentResponseContext(input.responseId);

  return confirmAssignment({
    assignmentId: response.assignmentId,
    volunteerProfileId: response.volunteerId,
    note: input.note
  });
}

export async function declineAssignmentResponseById(input: {
  responseId: string;
  note?: string;
}) {
  const response = await getAssignmentResponseContext(input.responseId);

  return declineAssignment({
    assignmentId: response.assignmentId,
    volunteerProfileId: response.volunteerId,
    note: input.note
  });
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
      .filter(
        (assignment) =>
          assignment.status === "NEEDS_REPLACEMENT" ||
          assignment.volunteers.length < 2
      )
      .map(async (assignment) => {
        const missingPositions = (
          ["FIRST", "SECOND"] as VolunteerPosition[]
        ).filter(
          (position) =>
            !assignment.volunteers.some((slot) => slot.position === position)
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

        const positions = [
          ...new Set([...missingPositions, ...declinedPositions])
        ];
        const suggestions = await getAvailableVolunteersForSlot({
          date: assignment.date,
          dayOfWeek: assignment.dayOfWeek,
          timeSlot: assignment.timeSlot,
          area: assignment.preachingPoint.area,
          excludeVolunteerIds: assignment.volunteers.map(
            (item) => item.volunteerId
          )
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
              ? "Urgente"
              : "Vacante",
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
      (position) =>
        !assignment.volunteers.some((slot) => slot.position === position)
    ) ??
    assignment.volunteers[assignment.volunteers.length - 1]?.position;

  if (!targetPosition) {
    throw new AppError(
      "No se encontró un puesto disponible para el voluntario.",
      400
    );
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

  return {
    weekLabel: schedule.weekLabel,
    stats: {
      totalAssignments: assignments.length,
      confirmedAssignments: assignments.filter(
        (item) => item.status === "CONFIRMED"
      ).length,
      pendingConfirmations: assignments.filter(
        (item) => item.status === "PENDING_CONFIRMATION"
      ).length,
      declinedAssignments: assignments.filter(
        (item) => item.status === "DECLINED"
      ).length,
      openSlots: openSlots.length
    },
    todaysAssignments: details.filter(
      (assignment) => assignment.date.toDateString() === today.toDateString()
    ),
    pendingConfirmations: details.filter(
      (assignment) => assignment.status === "PENDING_CONFIRMATION"
    ),
    urgentReplacements: openSlots.filter(
      (slot) => slot.urgencyLabel === "Urgente"
    )
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
    orderBy: [{ date: "desc" }, { pairNumber: "asc" }]
  });

  return assignments.map(mapAssignmentDetail);
}

export async function sendAssignmentConfirmationRequests(assignmentId: string) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      preachingPoint: true,
      responses: true,
      volunteers: {
        include: {
          volunteer: {
            include: { user: true }
          }
        }
      }
    }
  });

  if (!assignment.volunteers.length) {
    throw new AppError(
      "No hay voluntarios asignados para solicitar confirmación.",
      400
    );
  }

  await Promise.all(
    assignment.volunteers.map(async (slot) => {
      const response = assignment.responses.find(
        (item) => item.volunteerId === slot.volunteerId
      );
      const confirmationLink = response
        ? buildConfirmationLink(response.id)
        : null;

      await sendEmailNotification({
        userId: slot.volunteer.userId,
        assignmentId,
        type: "CONFIRMATION_REQUEST",
        subject: "Confirma tu asignación de PPAM",
        html: `<p>Hola ${slot.volunteer.user.name},</p><p>Tienes asignación en ${assignment.preachingPoint.name} el ${DAY_LABELS[assignment.dayOfWeek]} en el horario ${TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}.</p>${confirmationLink ? `<p><a href="${confirmationLink}">Abrir confirmación directa</a></p>` : ""}`,
        metadata: {
          pointName: assignment.preachingPoint.name,
          confirmationLink
        }
      });
      await db.assignmentActivity.create({
        data: {
          assignmentId,
          actionType: "REMINDER_SENT",
          metadata: {
            volunteerProfileId: slot.volunteerId,
            deliveryType: "CONFIRMATION_REQUEST"
          }
        }
      });
    })
  );

  return {
    sentCount: assignment.volunteers.length
  };
}

export async function resendAssignmentConfirmation(assignmentId: string) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      preachingPoint: true,
      responses: true,
      volunteers: {
        include: {
          volunteer: {
            include: { user: true }
          }
        }
      }
    }
  });

  const pendingVolunteers = assignment.volunteers.filter((slot) =>
    assignment.responses.some(
      (response) =>
        response.volunteerId === slot.volunteerId &&
        response.responseStatus === "PENDING"
    )
  );

  if (!pendingVolunteers.length) {
    throw new AppError("No hay confirmaciones pendientes para reenviar.", 400);
  }

  await Promise.all(
    pendingVolunteers.map(async (slot) => {
      const response = assignment.responses.find(
        (item) => item.volunteerId === slot.volunteerId
      );
      const confirmationLink = response
        ? buildConfirmationLink(response.id)
        : null;

      await resendConfirmationReminder({
        assignmentId,
        volunteerUserId: slot.volunteer.userId,
        volunteerName: slot.volunteer.user.name,
        pointName: assignment.preachingPoint.name,
        dateLabel: DAY_LABELS[assignment.dayOfWeek],
        timeSlotLabel: TIME_SLOT_DEFINITIONS[assignment.timeSlot].label,
        confirmationLink
      });

      await db.assignmentActivity.create({
        data: {
          assignmentId,
          actionType: "REMINDER_SENT",
          metadata: {
            volunteerProfileId: slot.volunteerId,
            deliveryType: "REMINDER"
          }
        }
      });
    })
  );

  return {
    sentCount: pendingVolunteers.length
  };
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
      assignment.status === "NEEDS_REPLACEMENT" ||
      assignment.volunteers.length < 2
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
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }, { pairNumber: "asc" }]
  });

  return assignments.map(mapAssignmentDetail);
}
