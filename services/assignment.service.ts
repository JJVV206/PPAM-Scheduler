import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  isSameDay,
  startOfDay,
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
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";
import type {
  AdminDashboardStats,
  AssignmentDetailDto,
  AssignmentInvitationDto,
  AssignmentVolunteerDto,
  OpenSlotDto,
  VolunteerSummary,
  WeeklySchedulePointCell,
  WeeklyScheduleMatrix
} from "@/types/domain";
import { AppError } from "@/services/errors";
import { getAppSettings } from "@/services/setting.service";
import { resendConfirmationReminder } from "@/services/notification.service";
import {
  ACTIVE_ASSIGNMENT_INVITATION_STATUSES,
  buildAssignmentInvitationResponseUrl,
  createPendingPrimaryInvitationsForAssignment,
  getAssignmentInvitationAvailability,
  sendPendingPrimaryInvitationsForAssignment
} from "@/services/assignment-invitation.service";
import { prepareScheduleWeekAutomation } from "@/services/schedule-week-preparation.service";
import { safePercentage } from "@/lib/utils";
import { determineAssignmentStatus } from "@/services/assignment-engine";
import { getSingletonPreachingPoint } from "@/services/point.service";
import {
  getReplacementCandidatesForAssignment,
  toVolunteerSummary
} from "@/services/replacement-candidate.service";
import { inviteNextAvailableReplacementForAssignment } from "@/services/assignment-automation.service";
import {
  deriveAssignmentAutomationState,
  isAssignmentRequiringAttention
} from "@/services/assignment-ui-state.service";
import { recordAssignmentAuditActivity } from "@/services/assignment-audit.service";
import {
  createVolunteerAssignmentConfirmedAppNotification,
  markAssignmentPendingAppNotificationsRead
} from "@/services/app-notification.service";

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
  },
  invitations: {
    include: {
      volunteer: {
        include: {
          user: true
        }
      }
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
  canServeAsReplacement: boolean;
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
    temporaryUnavailable: record.temporaryUnavailable,
    canServeAsReplacement: record.canServeAsReplacement
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
  const invitations: AssignmentInvitationDto[] = assignment.invitations.map(
    (invitation) => ({
      id: invitation.id,
      volunteerId: invitation.volunteerId,
      volunteerName: invitation.volunteer.user.name,
      type: invitation.type,
      status: invitation.status,
      sentAt: invitation.sentAt,
      respondedAt: invitation.respondedAt,
      expiresAt: invitation.expiresAt,
      emailAttempts: invitation.emailAttempts,
      createdAt: invitation.createdAt
    })
  );
  const timeline = assignment.activities.map((activity) => ({
    id: activity.id,
    actionType: activity.actionType,
    createdAt: activity.createdAt,
    actorName: activity.actorUser?.name ?? null,
    metadata: activity.metadata as Record<string, unknown> | null
  }));
  const automationState = deriveAssignmentAutomationState({
    status: assignment.status,
    invitations,
    volunteers,
    timeline
  });
  const requiresAttention = isAssignmentRequiringAttention({
    status: assignment.status,
    invitations,
    volunteers,
    timeline
  });

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
      name: FIXED_PREACHING_POINT_NAME,
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
    invitations,
    automationState,
    timeline,
    warnings: calculateWarnings({
      volunteerCount: volunteers.length,
      hasDecline: volunteers.some(
        (volunteer) => volunteer.responseStatus === "DECLINED"
      )
    }),
    requiresAttention
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
      `El punto ${FIXED_PREACHING_POINT_NAME} no está habilitado para ${DAY_LABELS[input.dayOfWeek]} en ${TIME_SLOT_DEFINITIONS[input.timeSlot].label}.`,
      409
    );
  }
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

function asJsonObject(value: Prisma.JsonValue | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function difference(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function compactJsonMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
}

function mergeJsonMetadata(
  current: Prisma.JsonValue | null,
  next: Record<string, unknown>
) {
  return compactJsonMetadata({
    ...asJsonObject(current),
    ...next
  });
}

export function selectReplacementAssignmentPosition(input: {
  volunteers: Array<{ volunteerId: string; position: VolunteerPosition }>;
  responses: Array<{ volunteerId: string; responseStatus: ResponseStatus }>;
}): VolunteerPosition | null {
  const declinedResponse = input.responses.find(
    (response) => response.responseStatus === "DECLINED"
  );
  const declinedSlot = declinedResponse
    ? input.volunteers.find(
        (volunteer) => volunteer.volunteerId === declinedResponse.volunteerId
      )
    : null;

  if (declinedSlot) {
    return declinedSlot.position;
  }

  return (
    (["FIRST", "SECOND"] as VolunteerPosition[]).find(
      (position) =>
        !input.volunteers.some((volunteer) => volunteer.position === position)
    ) ??
    input.volunteers[input.volunteers.length - 1]?.position ??
    null
  );
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
  const fixedPoint = await getSingletonPreachingPoint();

  await assertPointSupportsSlot({
    preachingPointId: fixedPoint.id,
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
        preachingPointId: fixedPoint.id
      }));

    const created = await tx.assignment.create({
      data: {
        scheduleWeekId: input.scheduleWeekId,
        date: input.date,
        dayOfWeek: input.dayOfWeek,
        timeSlot: input.timeSlot,
        preachingPointId: fixedPoint.id,
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

      await createPendingPrimaryInvitationsForAssignment({
        tx,
        assignmentId: created.id,
        volunteerIds: uniqueVolunteerIds,
        actorUserId: input.actorUserId,
        source: "assignment_created"
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

  await sendPendingPrimaryInvitationsForAssignment({
    assignmentId: assignment.id,
    actorUserId: input.actorUserId
  });

  const refreshedAssignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignment.id },
    include: assignmentInclude
  });

  return mapAssignmentDetail(refreshedAssignment);
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
  const fixedPoint = await getSingletonPreachingPoint();

  const nextDate = input.date ?? current.date;
  const nextDayOfWeek = input.dayOfWeek ?? current.dayOfWeek;
  const nextTimeSlot = input.timeSlot ?? current.timeSlot;
  const nextPreachingPointId = fixedPoint.id;
  const volunteerIds =
    input.volunteers?.map((item) => item.volunteerId) ??
    current.volunteers.map((item) => item.volunteerId);
  const currentVolunteerIds = current.volunteers.map(
    (volunteer) => volunteer.volunteerId
  );
  const nextVolunteerIds = [...new Set(volunteerIds)];
  const removedVolunteerIds = input.volunteers
    ? difference(currentVolunteerIds, nextVolunteerIds)
    : [];
  const addedVolunteerIds = input.volunteers
    ? difference(nextVolunteerIds, currentVolunteerIds)
    : [];
  const movedToNewSlot =
    !isSameDay(nextDate, current.date) ||
    nextTimeSlot !== current.timeSlot ||
    nextPreachingPointId !== current.preachingPointId;
  const statusChangedAt = input.status ? new Date() : undefined;
  const updatedFields = Object.entries(input)
    .filter(([field, value]) => field !== "actorUserId" && value !== undefined)
    .map(([field]) => field);

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
        preachingPointId: nextPreachingPointId,
        pairNumber,
        notes: input.notes,
        status: input.status,
        cancelledAt:
          input.status === "CANCELLED"
            ? statusChangedAt
            : input.status && current.status === "CANCELLED"
              ? null
              : undefined,
        completedAt:
          input.status === "COMPLETED"
            ? statusChangedAt
            : input.status && current.status === "COMPLETED"
              ? null
              : undefined
      }
    });

    if (input.volunteers) {
      const activeInvitationsToInvalidate = removedVolunteerIds.length
        ? await tx.assignmentInvitation.findMany({
            where: {
              assignmentId,
              volunteerId: {
                in: removedVolunteerIds
              },
              type: "PRIMARY",
              status: {
                in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
              }
            }
          })
        : [];

      for (const invitation of activeInvitationsToInvalidate) {
        const invalidatedReason =
          invitation.status === "PENDING"
            ? "primary_volunteer_changed_before_send"
            : "primary_volunteer_changed_after_send";

        await tx.assignmentInvitation.update({
          where: {
            id: invitation.id
          },
          data: {
            status: "EXPIRED",
            metadata: mergeJsonMetadata(invitation.metadata, {
              invalidatedAt: new Date().toISOString(),
              invalidatedBy: "assignment_update",
              invalidatedReason,
              actorUserId: input.actorUserId
            })
          }
        });
        await recordAssignmentAuditActivity({
          client: tx,
          assignmentId,
          actorUserId: input.actorUserId,
          event: "INVITATION_EXPIRED",
          dedupeKey: `invitation-invalidated:${invitation.id}`,
          metadata: {
            invitationId: invitation.id,
            invitationType: "PRIMARY",
            volunteerProfileId: invitation.volunteerId,
            previousStatus: invitation.status,
            source: "assignment_update",
            reason: invalidatedReason
          }
        });
      }

      await tx.assignmentVolunteer.deleteMany({ where: { assignmentId } });
      if (input.volunteers.length) {
        await tx.assignmentVolunteer.createMany({
          data: input.volunteers.map((volunteer) => ({
            assignmentId,
            volunteerId: volunteer.volunteerId,
            position: volunteer.position
          }))
        });
        await createPendingPrimaryInvitationsForAssignment({
          tx,
          assignmentId,
          volunteerIds: nextVolunteerIds,
          actorUserId: input.actorUserId,
          source: "assignment_updated",
          metadata: {
            addedVolunteerIds,
            removedVolunteerIds
          }
        });
      }
      await syncResponses({
        tx,
        assignmentId,
        volunteerIds: nextVolunteerIds
      });
    }

    await tx.assignmentActivity.create({
      data: {
        assignmentId,
        actorUserId: input.actorUserId,
        actionType:
          input.status === "CANCELLED"
            ? "CANCELLED"
            : input.status === "COMPLETED"
              ? "COMPLETED"
              : updatedFields.length === 1 && updatedFields[0] === "notes"
                ? "NOTES_UPDATED"
                : "STATUS_OVERRIDDEN",
        metadata: {
          updatedFields,
          previousStatus: current.status,
          nextStatus: input.status,
          previousVolunteerIds: input.volunteers ? currentVolunteerIds : undefined,
          nextVolunteerIds: input.volunteers ? nextVolunteerIds : undefined,
          addedVolunteerIds: input.volunteers ? addedVolunteerIds : undefined,
          removedVolunteerIds: input.volunteers ? removedVolunteerIds : undefined
        }
      }
    });

    if (!input.status) {
      await recalculateAssignmentStatus(assignmentId, tx);
    }

    return tx.assignment.findUniqueOrThrow({
      where: { id: updated.id },
      include: assignmentInclude
    });
  });

  if (input.volunteers) {
    await sendPendingPrimaryInvitationsForAssignment({
      assignmentId,
      actorUserId: input.actorUserId
    });
  }

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
      date: {
        gte: startOfDay(input.date),
        lte: endOfDay(input.date)
      },
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
  const fixedPoint = await getSingletonPreachingPoint();
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
      (group) => group.preachingPointId === fixedPoint.id
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
      preachingPointId: fixedPoint.id,
      preachingPointName: FIXED_PREACHING_POINT_NAME,
      area: fixedPoint.area,
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

  const week = await db.scheduleWeek.create({
    data: {
      startDate: weekStart,
      endDate: addDays(weekStart, 6),
      label: `Semana del ${weekStart.toLocaleDateString("es-MX")}`,
      createdById: input.actorUserId
    }
  });

  await prepareScheduleWeekAutomation({
    scheduleWeekId: week.id,
    actorUserId: input.actorUserId
  });

  return week;
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

  await prepareScheduleWeekAutomation({
    scheduleWeekId: targetWeek.id,
    actorUserId: input.actorUserId
  });

  return targetWeek;
}

export async function confirmAssignment(input: {
  assignmentId: string;
  volunteerProfileId: string;
  note?: string;
}) {
  const now = new Date();
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
        respondedAt: now
      },
      create: {
        assignmentId: input.assignmentId,
        volunteerId: input.volunteerProfileId,
        responseStatus: "CONFIRMED",
        note: input.note,
        respondedAt: now
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
    await markAssignmentPendingAppNotificationsRead({
      client: tx,
      assignmentId: input.assignmentId,
      volunteerProfileId: input.volunteerProfileId,
      readAt: now
    });

    await tx.volunteerProfile.update({
      where: { id: input.volunteerProfileId },
      data: {
        confirmationCount: {
          increment: 1
        }
      }
    });

    const updatedAssignment = await tx.assignment.findUniqueOrThrow({
      where: { id: input.assignmentId },
      include: assignmentInclude
    });

    await createVolunteerAssignmentConfirmedAppNotification({
      client: tx,
      assignmentId: input.assignmentId,
      volunteerProfileId: input.volunteerProfileId,
      assignment: updatedAssignment,
      source: "assignment_response"
    });

    return updatedAssignment;
  });

  return mapAssignmentDetail(assignment);
}

export async function declineAssignment(input: {
  assignmentId: string;
  volunteerProfileId: string;
  note?: string;
}) {
  const now = new Date();
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
        respondedAt: now
      },
      create: {
        assignmentId: input.assignmentId,
        volunteerId: input.volunteerProfileId,
        responseStatus: "DECLINED",
        note: input.note,
        respondedAt: now
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
    await markAssignmentPendingAppNotificationsRead({
      client: tx,
      assignmentId: input.assignmentId,
      volunteerProfileId: input.volunteerProfileId,
      readAt: now
    });

    return tx.assignment.findUniqueOrThrow({
      where: { id: input.assignmentId },
      include: assignmentInclude
    });
  });

  await inviteNextAvailableReplacementForAssignment({
    assignmentId: assignment.id
  });

  return mapAssignmentDetail(assignment);
}

export type AssignmentInvitationConfirmationContext =
  | {
      state: "READY";
      token: string;
      invitationType: "PRIMARY" | "REPLACEMENT";
      date: Date;
      timeSlot: TimeSlot;
      pointName: string;
      expiresAt: Date;
    }
  | {
      state: "NOT_FOUND";
    }
  | {
      state: "EXPIRED" | "RESPONDED" | "FAILED";
      token: string;
      invitationType: "PRIMARY" | "REPLACEMENT";
      date: Date;
      timeSlot: TimeSlot;
      pointName: string;
      expiresAt: Date;
      respondedAt?: Date | null;
    };

export async function getAssignmentInvitationConfirmationContext(
  token: string
): Promise<AssignmentInvitationConfirmationContext> {
  const invitation = await db.assignmentInvitation.findUnique({
    where: { token },
    include: {
      assignment: {
        include: {
          preachingPoint: true
        }
      }
    }
  });

  if (!invitation) {
    return {
      state: "NOT_FOUND"
    };
  }

  const availability = getAssignmentInvitationAvailability({
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    respondedAt: invitation.respondedAt
  });
  const context = {
    token: invitation.token,
    invitationType: invitation.type,
    date: invitation.assignment.date,
    timeSlot: invitation.assignment.timeSlot,
    pointName: FIXED_PREACHING_POINT_NAME,
    expiresAt: invitation.expiresAt,
    respondedAt: invitation.respondedAt
  };

  if (availability === "READY") {
    return {
      state: "READY",
      ...context
    };
  }

  return {
    state: availability,
    ...context
  };
}

function getInvitationResponseError(
  state: Exclude<AssignmentInvitationConfirmationContext["state"], "READY">
) {
  switch (state) {
    case "NOT_FOUND":
      return new AppError("No se encontró esta invitación.", 404);
    case "EXPIRED":
      return new AppError("Esta invitación ya expiró.", 410);
    case "RESPONDED":
      return new AppError("Esta invitación ya fue respondida.", 409);
    case "FAILED":
      return new AppError(
        "Esta invitación no está disponible. Solicita una nueva invitación.",
        409
      );
  }
}

async function markExpiredInvitationIfNeeded(input: {
  id: string;
  assignmentId: string;
  volunteerId: string;
  type: "PRIMARY" | "REPLACEMENT";
  expiresAt: Date;
  metadata: Prisma.JsonValue | null;
}) {
  const expiredAt = new Date();
  let replacementRequired = false;

  await db.$transaction(async (tx) => {
    await tx.assignmentInvitation.update({
      where: { id: input.id },
      data: {
        status: "EXPIRED",
        metadata: mergeJsonMetadata(input.metadata, {
          expiredAt: expiredAt.toISOString(),
          expireReason: "response_attempt_after_expiration"
        })
      }
    });
    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId: input.assignmentId,
      event: "INVITATION_EXPIRED",
      dedupeKey: `invitation-expired:${input.id}`,
      metadata: {
        invitationId: input.id,
        invitationType: input.type,
        volunteerProfileId: input.volunteerId,
        expiresAt: input.expiresAt,
        expiredAt,
        source: "response_attempt_after_expiration"
      }
    });

    await tx.volunteerProfile.update({
      where: {
        id: input.volunteerId
      },
      data: {
        noResponseCount: {
          increment: 1
        }
      }
    });

    const updatedAssignment = await tx.assignment.updateMany({
      where: {
        id: input.assignmentId,
        status: {
          notIn: ["CANCELLED", "COMPLETED"]
        }
      },
      data: {
        status: "NEEDS_REPLACEMENT"
      }
    });

    if (updatedAssignment.count !== 1) {
      return;
    }

    const dedupeKey = `replacement-required:${input.id}`;
    const existingActivity = await tx.assignmentActivity.findFirst({
      where: {
        assignmentId: input.assignmentId,
        actionType: "REPLACEMENT_REQUIRED",
        metadata: {
          path: ["dedupeKey"],
          equals: dedupeKey
        }
      },
      select: {
        id: true
      }
    });

    if (!existingActivity) {
      await tx.assignmentActivity.create({
        data: {
          assignmentId: input.assignmentId,
          actionType: "REPLACEMENT_REQUIRED",
          metadata: compactJsonMetadata({
            dedupeKey,
            reason: "invitation_expired",
            invitationId: input.id,
            invitationType: input.type,
            volunteerProfileId: input.volunteerId,
            source: "response_attempt_after_expiration",
            expiredAt: expiredAt.toISOString()
          })
        }
      });
    }

    replacementRequired = true;
  });

  return {
    replacementRequired
  };
}

export async function respondToAssignmentInvitation(input: {
  token: string;
  responseStatus: "CONFIRMED" | "DECLINED";
  note?: string;
}) {
  const preflightInvitation = await db.assignmentInvitation.findUnique({
    where: { token: input.token }
  });

  if (!preflightInvitation) {
    throw getInvitationResponseError("NOT_FOUND");
  }

  const preflightAvailability = getAssignmentInvitationAvailability({
    status: preflightInvitation.status,
    expiresAt: preflightInvitation.expiresAt,
    respondedAt: preflightInvitation.respondedAt
  });

  if (preflightAvailability === "EXPIRED") {
    let expirationResult: { replacementRequired: boolean } | undefined;

    if (preflightInvitation.status !== "EXPIRED") {
      expirationResult = await markExpiredInvitationIfNeeded({
        id: preflightInvitation.id,
        assignmentId: preflightInvitation.assignmentId,
        volunteerId: preflightInvitation.volunteerId,
        type: preflightInvitation.type,
        expiresAt: preflightInvitation.expiresAt,
        metadata: preflightInvitation.metadata
      });
    }

    if (expirationResult?.replacementRequired) {
      await inviteNextAvailableReplacementForAssignment({
        assignmentId: preflightInvitation.assignmentId
      });
    }

    throw getInvitationResponseError("EXPIRED");
  }

  if (preflightAvailability !== "READY") {
    throw getInvitationResponseError(preflightAvailability);
  }

  const now = new Date();
  const assignment = await db.$transaction(async (tx) => {
    const invitation = await tx.assignmentInvitation.findUniqueOrThrow({
      where: { token: input.token }
    });
    const availability = getAssignmentInvitationAvailability({
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      respondedAt: invitation.respondedAt,
      now
    });

    if (availability !== "READY") {
      throw getInvitationResponseError(availability);
    }

    if (
      invitation.type === "REPLACEMENT" &&
      input.responseStatus === "CONFIRMED"
    ) {
      const currentAssignment = await tx.assignment.findUniqueOrThrow({
        where: { id: invitation.assignmentId },
        include: {
          volunteers: true,
          responses: true
        }
      });
      const targetPosition = selectReplacementAssignmentPosition({
        volunteers: currentAssignment.volunteers,
        responses: currentAssignment.responses
      });

      if (!targetPosition) {
        throw new AppError(
          "No se encontró un puesto disponible para asignar el reemplazo.",
          400
        );
      }

      const existingPosition = currentAssignment.volunteers.find(
        (slot) => slot.position === targetPosition
      );
      const existingReplacementSlot = currentAssignment.volunteers.find(
        (slot) => slot.volunteerId === invitation.volunteerId
      );

      if (
        existingReplacementSlot &&
        existingReplacementSlot.id !== existingPosition?.id
      ) {
        await tx.assignmentVolunteer.delete({
          where: { id: existingReplacementSlot.id }
        });
      }

      if (
        existingPosition &&
        existingPosition.volunteerId !== invitation.volunteerId
      ) {
        await tx.assignmentVolunteer.delete({
          where: { id: existingPosition.id }
        });
        await tx.assignmentResponse.deleteMany({
          where: {
            assignmentId: invitation.assignmentId,
            volunteerId: existingPosition.volunteerId
          }
        });
      }

      if (existingPosition?.volunteerId === invitation.volunteerId) {
        await tx.assignmentVolunteer.update({
          where: { id: existingPosition.id },
          data: {
            position: targetPosition,
            isReplacement: true
          }
        });
      } else {
        await tx.assignmentVolunteer.create({
          data: {
            assignmentId: invitation.assignmentId,
            volunteerId: invitation.volunteerId,
            position: targetPosition,
            isReplacement: true
          }
        });
      }

      await tx.assignmentInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          respondedAt: now,
          metadata: mergeJsonMetadata(invitation.metadata, {
            responseStatus: input.responseStatus,
            respondedVia: "PUBLIC_INVITATION_LINK",
            responseRecordedAt: now.toISOString(),
            assignedPosition: targetPosition
          })
        }
      });
      await recordAssignmentAuditActivity({
        client: tx,
        assignmentId: invitation.assignmentId,
        event: "INVITATION_ACCEPTED",
        dedupeKey: `invitation-response:${invitation.id}`,
        metadata: {
          invitationId: invitation.id,
          invitationType: invitation.type,
          volunteerProfileId: invitation.volunteerId,
          responseStatus: input.responseStatus,
          respondedAt: now,
          source: "PUBLIC_INVITATION_LINK",
          assignedPosition: targetPosition
        }
      });

      await tx.assignmentResponse.upsert({
        where: {
          assignmentId_volunteerId: {
            assignmentId: invitation.assignmentId,
            volunteerId: invitation.volunteerId
          }
        },
        update: {
          responseStatus: "CONFIRMED",
          note: input.note,
          respondedAt: now
        },
        create: {
          assignmentId: invitation.assignmentId,
          volunteerId: invitation.volunteerId,
          responseStatus: "CONFIRMED",
          note: input.note,
          respondedAt: now
        }
      });

      await tx.assignment.update({
        where: { id: invitation.assignmentId },
        data: { status: "REASSIGNED" }
      });

      await tx.assignmentActivity.create({
        data: {
          assignmentId: invitation.assignmentId,
          actionType: "REPLACEMENT_ASSIGNED",
          metadata: {
            volunteerProfileId: invitation.volunteerId,
            invitationId: invitation.id,
            position: targetPosition,
            source: "PUBLIC_INVITATION_LINK",
            note: input.note
          }
        }
      });

      await tx.volunteerProfile.update({
        where: { id: invitation.volunteerId },
        data: {
          confirmationCount: {
            increment: 1
          }
        }
      });

      await recalculateAssignmentStatus(invitation.assignmentId, tx);
      await markAssignmentPendingAppNotificationsRead({
        client: tx,
        assignmentId: invitation.assignmentId,
        volunteerProfileId: invitation.volunteerId,
        readAt: now
      });

      const updatedAssignment = await tx.assignment.findUniqueOrThrow({
        where: { id: invitation.assignmentId },
        include: assignmentInclude
      });

      await createVolunteerAssignmentConfirmedAppNotification({
        client: tx,
        assignmentId: invitation.assignmentId,
        volunteerProfileId: invitation.volunteerId,
        assignment: updatedAssignment,
        source: "assignment_invitation",
        invitationId: invitation.id,
        invitationType: invitation.type
      });

      return updatedAssignment;
    }

    await tx.assignmentInvitation.update({
      where: { id: invitation.id },
      data: {
        status: input.responseStatus === "CONFIRMED" ? "ACCEPTED" : "DECLINED",
        respondedAt: now,
        metadata: mergeJsonMetadata(invitation.metadata, {
          responseStatus: input.responseStatus,
          respondedVia: "PUBLIC_INVITATION_LINK",
          responseRecordedAt: now.toISOString()
        })
      }
    });
    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId: invitation.assignmentId,
      event:
        input.responseStatus === "CONFIRMED"
          ? "INVITATION_ACCEPTED"
          : "INVITATION_DECLINED",
      dedupeKey: `invitation-response:${invitation.id}`,
      metadata: {
        invitationId: invitation.id,
        invitationType: invitation.type,
        volunteerProfileId: invitation.volunteerId,
        responseStatus: input.responseStatus,
        respondedAt: now,
        source: "PUBLIC_INVITATION_LINK"
      }
    });

    await tx.assignmentResponse.upsert({
      where: {
        assignmentId_volunteerId: {
          assignmentId: invitation.assignmentId,
          volunteerId: invitation.volunteerId
        }
      },
      update: {
        responseStatus: input.responseStatus,
        note: input.note,
        respondedAt: now
      },
      create: {
        assignmentId: invitation.assignmentId,
        volunteerId: invitation.volunteerId,
        responseStatus: input.responseStatus,
        note: input.note,
        respondedAt: now
      }
    });

    if (input.responseStatus === "DECLINED") {
      await tx.assignment.update({
        where: { id: invitation.assignmentId },
        data: { status: "NEEDS_REPLACEMENT" }
      });
    }

    await tx.assignmentActivity.create({
      data: {
        assignmentId: invitation.assignmentId,
        actionType: "RESPONSE_RECEIVED",
        metadata: {
          volunteerProfileId: invitation.volunteerId,
          responseStatus: input.responseStatus,
          note: input.note,
          invitationId: invitation.id,
          invitationType: invitation.type,
          source: "PUBLIC_INVITATION_LINK",
          replacementAutomationPending: input.responseStatus === "DECLINED"
        }
      }
    });

    await tx.volunteerProfile.update({
      where: { id: invitation.volunteerId },
      data:
        input.responseStatus === "CONFIRMED"
          ? {
              confirmationCount: {
                increment: 1
              }
            }
          : {
              declineCount: {
                increment: 1
              }
            }
    });

    await recalculateAssignmentStatus(invitation.assignmentId, tx);
    await markAssignmentPendingAppNotificationsRead({
      client: tx,
      assignmentId: invitation.assignmentId,
      volunteerProfileId: invitation.volunteerId,
      readAt: now
    });

    const updatedAssignment = await tx.assignment.findUniqueOrThrow({
      where: { id: invitation.assignmentId },
      include: assignmentInclude
    });

    if (input.responseStatus === "CONFIRMED") {
      await createVolunteerAssignmentConfirmedAppNotification({
        client: tx,
        assignmentId: invitation.assignmentId,
        volunteerProfileId: invitation.volunteerId,
        assignment: updatedAssignment,
        source: "assignment_invitation",
        invitationId: invitation.id,
        invitationType: invitation.type
      });
    }

    return updatedAssignment;
  });

  if (input.responseStatus === "DECLINED") {
    await inviteNextAvailableReplacementForAssignment({
      assignmentId: assignment.id
    });
  }

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
  volunteerProfileId?: string;
  note?: string;
}) {
  const response = await getAssignmentResponseContext(input.responseId);

  if (
    input.volunteerProfileId &&
    response.volunteerId !== input.volunteerProfileId
  ) {
    throw new AppError("No puedes responder esta asignación.", 403);
  }

  return confirmAssignment({
    assignmentId: response.assignmentId,
    volunteerProfileId: response.volunteerId,
    note: input.note
  });
}

export async function declineAssignmentResponseById(input: {
  responseId: string;
  volunteerProfileId?: string;
  note?: string;
}) {
  const response = await getAssignmentResponseContext(input.responseId);

  if (
    input.volunteerProfileId &&
    response.volunteerId !== input.volunteerProfileId
  ) {
    throw new AppError("No puedes responder esta asignación.", 403);
  }

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
      date: {
        gte: startOfDay(new Date())
      },
      status: {
        notIn: ["CANCELLED", "COMPLETED"]
      },
      OR: [
        { status: { in: ["NEEDS_REPLACEMENT", "DECLINED"] } },
        { volunteers: { none: { position: "FIRST" } } },
        { volunteers: { none: { position: "SECOND" } } }
      ]
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
        const suggestions = await getReplacementCandidatesForAssignment({
          assignmentId: assignment.id,
          take: 6
        });

        return {
          assignmentId: assignment.id,
          date: assignment.date,
          dayOfWeek: assignment.dayOfWeek,
          timeSlot: assignment.timeSlot,
          preachingPointId: assignment.preachingPointId,
          preachingPointName: FIXED_PREACHING_POINT_NAME,
          area: assignment.preachingPoint.area,
          status: assignment.status,
          missingPositions: positions.length ? positions : ["SECOND"],
          urgencyLabel:
            differenceInCalendarDays(assignment.date, new Date()) <= 2
              ? "Urgente"
              : "Vacante",
          suggestedVolunteers: suggestions.map(toVolunteerSummary),
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
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const today = startOfDay(new Date());
  const upcomingEnd = endOfDay(addDays(today, 3));
  const [
    assignments,
    openSlots,
    replacementCensus,
    failedEmails,
    expiredPrimaryInvitations,
    expiredReplacementInvitations
  ] = await Promise.all([
    db.assignment.findMany({
      where: {
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      include: assignmentInclude,
      orderBy: [{ date: "asc" }, { timeSlot: "asc" }, { pairNumber: "asc" }]
    }),
    getOpenSlots(),
    db.replacementCensus.findFirst({
      where: {
        scheduleWeek: {
          startDate: weekStart
        }
      },
      include: {
        responses: {
          select: {
            status: true
          }
        }
      }
    }),
    db.notificationLog.count({
      where: {
        status: "FAILED",
        createdAt: {
          gte: weekStart,
          lte: weekEnd
        }
      }
    }),
    db.assignmentInvitation.count({
      where: {
        type: "PRIMARY",
        status: "EXPIRED",
        assignment: {
          date: {
            gte: today
          }
        }
      }
    }),
    db.assignmentInvitation.count({
      where: {
        type: "REPLACEMENT",
        status: "EXPIRED",
        assignment: {
          date: {
            gte: today
          }
        }
      }
    })
  ]);

  const details = assignments.map(mapAssignmentDetail);
  const requiresAttention = details.filter(
    (assignment) => assignment.requiresAttention
  );
  const totalCensusResponses = replacementCensus?.responses.length ?? 0;
  const submittedCensusResponses =
    replacementCensus?.responses.filter(
      (response) => response.status === "SUBMITTED"
    ).length ?? 0;
  const pendingCensusResponses =
    replacementCensus?.responses.filter((response) =>
      ["PENDING", "SENT"].includes(response.status)
    ).length ?? 0;
  const declinedCensusResponses =
    replacementCensus?.responses.filter(
      (response) => response.status === "DECLINED"
    ).length ?? 0;

  return {
    weekLabel: `Semana del ${weekStart.toLocaleDateString("es-MX")}`,
    stats: {
      totalAssignments: assignments.length,
      confirmedAssignments: assignments.filter(
        (item) => item.status === "CONFIRMED"
      ).length,
      pendingConfirmations: assignments.filter(
        (item) => item.status === "PENDING_CONFIRMATION"
      ).length,
      needsReplacement: assignments.filter(
        (item) => item.status === "NEEDS_REPLACEMENT"
      ).length,
      declinedAssignments: assignments.filter(
        (item) => item.status === "DECLINED"
      ).length,
      openSlots: openSlots.length,
      requiresAttention: requiresAttention.length
    },
    census: {
      status: replacementCensus?.status ?? "Sin censo",
      closesAt: replacementCensus?.closesAt ?? null,
      totalResponses: totalCensusResponses,
      submittedResponses: submittedCensusResponses,
      pendingResponses: pendingCensusResponses,
      declinedResponses: declinedCensusResponses,
      responseRate: safePercentage(submittedCensusResponses, totalCensusResponses)
    },
    alerts: {
      failedEmails,
      expiredPrimaryInvitations,
      expiredReplacementInvitations,
      uncoveredAssignments: requiresAttention.length
    },
    todaysAssignments: details.filter(
      (assignment) => isSameDay(assignment.date, today)
    ),
    upcomingAssignments: details.filter(
      (assignment) => assignment.date >= today && assignment.date <= upcomingEnd
    ),
    pendingConfirmations: details.filter(
      (assignment) => assignment.status === "PENDING_CONFIRMATION"
    ),
    requiresAttention,
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

export async function sendAssignmentConfirmationRequests(input: {
  assignmentId: string;
  actorUserId?: string;
}) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: input.assignmentId },
    include: {
      volunteers: true
    }
  });

  if (!assignment.volunteers.length) {
    throw new AppError(
      "No hay voluntarios asignados para solicitar confirmación.",
      400
    );
  }

  await createPendingPrimaryInvitationsForAssignment({
    assignmentId: input.assignmentId,
    volunteerIds: assignment.volunteers.map((slot) => slot.volunteerId),
    actorUserId: input.actorUserId,
    source: "manual_confirmation_request"
  });

  return sendPendingPrimaryInvitationsForAssignment({
    assignmentId: input.assignmentId,
    actorUserId: input.actorUserId
  });
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

  const activeInvitations = await db.assignmentInvitation.findMany({
    where: {
      assignmentId,
      volunteerId: {
        in: pendingVolunteers.map((slot) => slot.volunteerId)
      },
      type: "PRIMARY",
      status: {
        in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  await Promise.all(
    pendingVolunteers.map(async (slot) => {
      const invitation = activeInvitations.find(
        (item) => item.volunteerId === slot.volunteerId
      );
      const confirmationLink = invitation
        ? buildAssignmentInvitationResponseUrl(invitation.token)
        : null;

      const notification = await resendConfirmationReminder({
        assignmentId,
        volunteerUserId: slot.volunteer.userId,
        volunteerName: slot.volunteer.user.name,
        pointName: FIXED_PREACHING_POINT_NAME,
        dateLabel: DAY_LABELS[assignment.dayOfWeek],
        timeSlotLabel: TIME_SLOT_DEFINITIONS[assignment.timeSlot].label,
        confirmationLink
      });

      await recordAssignmentAuditActivity({
        assignmentId,
        event: "REMINDER_SENT",
        dedupeKey: `manual-reminder:${assignmentId}:${slot.volunteer.userId}:${notification.id}`,
        metadata: {
          volunteerProfileId: slot.volunteerId,
          volunteerUserId: slot.volunteer.userId,
          deliveryType: "MANUAL_REMINDER",
          notificationLogId: notification.id,
          notificationStatus: notification.status,
          invitationId: invitation?.id
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
