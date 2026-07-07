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
  TimeSlot
} from "@prisma/client";
import type { ScheduleWeek } from "@prisma/client";

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
  AssignmentPreflightWarningsDto,
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
import {
  prepareScheduleWeekAutomation,
  type PrepareScheduleWeekAutomationResult
} from "@/services/schedule-week-preparation.service";
import { formatDateRange, safePercentage } from "@/lib/utils";
import { mergeJsonMetadata } from "@/lib/utils/safe-metadata";
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
import { recordAutomationAuditLog } from "@/services/automation-audit-log.service";
import { deriveVolunteerServiceType } from "@/lib/volunteer-service-type";

const assignmentInclude = {
  scheduleWeek: true,
  preachingPoint: {
    include: {
      activeSlots: true
    }
  },
  volunteers: {
    orderBy: {
      slotNumber: "asc"
    },
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

const SAME_DAY_REPEAT_WARNING = "Integrante repetido este día";
const MIN_ASSIGNMENT_VOLUNTEERS = 2;
const BASE_ASSIGNMENT_SLOT_NUMBERS = [1, 2] as const;

type DuplicateScheduleWeekOnExisting = "throw" | "skip";
type DuplicateScheduleWeekSource = "week_duplicate" | "auto_week_rollover";

export type DuplicateScheduleWeekResult = {
  week: ScheduleWeek;
  created: boolean;
  assignmentCount: number;
  primaryInvitations?: PrepareScheduleWeekAutomationResult["primaryInvitations"];
  replacementCensus?: PrepareScheduleWeekAutomationResult["replacementCensus"];
  skippedReason?: "existing_week";
};

export type CreateScheduleWeekResult = {
  week: ScheduleWeek;
  automation: PrepareScheduleWeekAutomationResult;
};

type SameDayRepeatAssignment = {
  id: string;
  date: Date;
  timeSlot: TimeSlot;
  status: AssignmentStatus;
  volunteers: Array<{
    volunteerId: string;
  }>;
};

function getOperationalAssignmentStatusFilter(status?: AssignmentStatus) {
  return status ?? { not: "CANCELLED" as const };
}

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
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    active: boolean;
    accessStatus: string;
  };
}): VolunteerSummary {
  return {
    id: record.id,
    userId: record.userId,
    name: record.user.name,
    email: record.user.email,
    phone: record.user.phone,
    active:
      record.user.active &&
      record.user.accessStatus === "APPROVED" &&
      record.active,
    transportationNotes: record.transportationNotes,
    preferredAreas: record.preferredAreas,
    reliabilityScore: record.reliabilityScore,
    confirmationCount: record.confirmationCount,
    declineCount: record.declineCount,
    noResponseCount: record.noResponseCount,
    temporaryUnavailable: record.temporaryUnavailable,
    canServeAsPrimary: record.canServeAsPrimary,
    canServeAsReplacement: record.canServeAsReplacement,
    serviceType: deriveVolunteerServiceType(record)
  };
}

function getUniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getAssignmentDateKey(date: Date) {
  return startOfDay(date).toISOString();
}

function sortTimeSlots(timeSlots: TimeSlot[]) {
  return [...timeSlots].sort(
    (left, right) => TIME_SLOTS.indexOf(left) - TIME_SLOTS.indexOf(right)
  );
}

function getSameDayRepeatAssignmentIds(assignments: SameDayRepeatAssignment[]) {
  const assignmentsByVolunteerDay = new Map<
    string,
    SameDayRepeatAssignment[]
  >();

  for (const assignment of assignments) {
    if (assignment.status === "CANCELLED") continue;

    for (const volunteerId of getUniqueIds(
      assignment.volunteers.map((volunteer) => volunteer.volunteerId)
    )) {
      const key = `${getAssignmentDateKey(assignment.date)}:${volunteerId}`;
      const existingAssignments = assignmentsByVolunteerDay.get(key) ?? [];
      existingAssignments.push(assignment);
      assignmentsByVolunteerDay.set(key, existingAssignments);
    }
  }

  const repeatedAssignmentIds = new Set<string>();

  for (const dayAssignments of assignmentsByVolunteerDay.values()) {
    for (const assignment of dayAssignments) {
      const hasOtherTimeSlot = dayAssignments.some(
        (candidate) =>
          candidate.id !== assignment.id &&
          candidate.timeSlot !== assignment.timeSlot
      );

      if (hasOtherTimeSlot) {
        repeatedAssignmentIds.add(assignment.id);
      }
    }
  }

  return repeatedAssignmentIds;
}

async function getSameDayRepeatAssignmentIdsForDate(date: Date) {
  const assignments = await db.assignment.findMany({
    where: {
      date: {
        gte: startOfDay(date),
        lte: endOfDay(date)
      },
      status: {
        notIn: ["CANCELLED"]
      }
    },
    select: {
      id: true,
      date: true,
      timeSlot: true,
      status: true,
      volunteers: {
        select: {
          volunteerId: true
        }
      }
    }
  });

  return getSameDayRepeatAssignmentIds(assignments);
}

function calculateWarnings(input: {
  volunteerCount: number;
  hasDecline: boolean;
  duplicateBooking?: boolean;
  sameDayRepeat?: boolean;
}): string[] {
  const warnings: string[] = [];

  if (input.volunteerCount < 2) warnings.push("Pareja incompleta");
  if (input.hasDecline) warnings.push("Se requiere reemplazo");
  if (input.duplicateBooking) warnings.push("Posible asignación duplicada");
  if (input.sameDayRepeat) warnings.push(SAME_DAY_REPEAT_WARNING);

  return warnings;
}

function mapAssignmentDetail(
  assignment: Prisma.AssignmentGetPayload<{
    include: typeof assignmentInclude;
  }>,
  options: {
    sameDayRepeat?: boolean;
    sameDayRepeatAssignmentIds?: Set<string>;
  } = {}
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
        slotNumber: slot.slotNumber,
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
      createdAt: invitation.createdAt,
      responseUrlCopyAvailable:
        getAssignmentInvitationAvailability({
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          respondedAt: invitation.respondedAt
        }) === "READY"
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
      ),
      sameDayRepeat:
        options.sameDayRepeat ??
        options.sameDayRepeatAssignmentIds?.has(assignment.id)
    }),
    requiresAttention
  };
}

function mapAssignmentDetails(
  assignments: Prisma.AssignmentGetPayload<{
    include: typeof assignmentInclude;
  }>[]
) {
  const sameDayRepeatAssignmentIds = getSameDayRepeatAssignmentIds(assignments);

  return assignments.map((assignment) =>
    mapAssignmentDetail(assignment, { sameDayRepeatAssignmentIds })
  );
}

async function mapAssignmentDetailWithSameDayWarnings(
  assignment: Prisma.AssignmentGetPayload<{ include: typeof assignmentInclude }>
) {
  const sameDayRepeatAssignmentIds = await getSameDayRepeatAssignmentIdsForDate(
    assignment.date
  );

  return mapAssignmentDetail(assignment, { sameDayRepeatAssignmentIds });
}

export function normalizeScheduleWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function getScheduleWeekRange(date: Date) {
  const startDate = normalizeScheduleWeekStart(date);
  return {
    startDate,
    endDate: addDays(startDate, 6)
  };
}

async function assertWeekDoesNotExist(startDate: Date) {
  const { endDate } = getScheduleWeekRange(startDate);
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

export async function getNextAvailableScheduleWeekStart(input?: {
  fromDate?: Date;
  maxWeeksToCheck?: number;
}) {
  let candidate = normalizeScheduleWeekStart(input?.fromDate ?? new Date());
  const maxWeeksToCheck = input?.maxWeeksToCheck ?? 104;

  for (let index = 0; index < maxWeeksToCheck; index += 1) {
    const { startDate, endDate } = getScheduleWeekRange(candidate);
    const existingWeek = await db.scheduleWeek.findUnique({
      where: {
        startDate_endDate: {
          startDate,
          endDate
        }
      },
      select: {
        id: true
      }
    });

    if (!existingWeek) {
      return startDate;
    }

    candidate = addDays(startDate, 7);
  }

  throw new AppError("No fue posible encontrar una semana disponible.", 409);
}

export async function getRecommendedSourceWeekForTarget(input: {
  targetWeekStart: Date;
  requireAssignments?: boolean;
}) {
  const targetWeekStart = normalizeScheduleWeekStart(input.targetWeekStart);

  return db.scheduleWeek.findFirst({
    where: {
      startDate: {
        lt: targetWeekStart
      },
      assignments: input.requireAssignments
        ? {
            some: {
              status: {
                not: "CANCELLED"
              }
            }
          }
        : undefined
    },
    orderBy: {
      startDate: "desc"
    }
  });
}

export async function getScheduleWeekPreparationContext(input?: {
  selectedWeekStart?: Date;
}) {
  const recommendedTargetWeekStart = await getNextAvailableScheduleWeekStart({
    fromDate: input?.selectedWeekStart ?? new Date()
  });
  const recommendedSourceWeek = await getRecommendedSourceWeekForTarget({
    targetWeekStart: recommendedTargetWeekStart
  });

  return {
    recommendedTargetWeekStart,
    recommendedSourceWeekId: recommendedSourceWeek?.id ?? null
  };
}

async function assertPointSupportsSlot(input: {
  preachingPointId: string;
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlot;
  allowAllSlots?: boolean;
}) {
  if (input.allowAllSlots) {
    return;
  }

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

export async function getSameDayVolunteerRepeatWarnings(input: {
  assignmentId?: string;
  date: Date;
  timeSlot: TimeSlot;
  volunteerIds: string[];
}): Promise<AssignmentPreflightWarningsDto> {
  const volunteerIds = getUniqueIds(input.volunteerIds);

  if (!volunteerIds.length) {
    return {
      warnings: [],
      repeatedVolunteerIds: [],
      repeatedVolunteers: []
    };
  }

  const repeatedSlots = await db.assignmentVolunteer.findMany({
    where: {
      volunteerId: {
        in: volunteerIds
      },
      assignment: {
        date: {
          gte: startOfDay(input.date),
          lte: endOfDay(input.date)
        },
        id: input.assignmentId ? { not: input.assignmentId } : undefined,
        timeSlot: {
          not: input.timeSlot
        },
        status: {
          notIn: ["CANCELLED"]
        }
      }
    },
    include: {
      volunteer: {
        include: {
          user: true
        }
      },
      assignment: {
        select: {
          id: true,
          timeSlot: true
        }
      }
    }
  });

  const repeatedByVolunteer = new Map<
    string,
    {
      volunteerId: string;
      volunteerName: string;
      timeSlots: Set<TimeSlot>;
      assignmentIds: Set<string>;
    }
  >();

  for (const slot of repeatedSlots) {
    const existing = repeatedByVolunteer.get(slot.volunteerId) ?? {
      volunteerId: slot.volunteerId,
      volunteerName: slot.volunteer.user.name,
      timeSlots: new Set<TimeSlot>(),
      assignmentIds: new Set<string>()
    };

    existing.timeSlots.add(slot.assignment.timeSlot);
    existing.assignmentIds.add(slot.assignment.id);
    repeatedByVolunteer.set(slot.volunteerId, existing);
  }

  const repeatedVolunteers = [...repeatedByVolunteer.values()]
    .sort((left, right) =>
      left.volunteerName.localeCompare(right.volunteerName, "es-MX")
    )
    .map((item) => ({
      volunteerId: item.volunteerId,
      volunteerName: item.volunteerName,
      timeSlots: sortTimeSlots([...item.timeSlots]),
      assignmentIds: [...item.assignmentIds]
    }));
  const warnings = repeatedVolunteers.map((item) => {
    const timeSlotLabels = item.timeSlots
      .map((timeSlot) => TIME_SLOT_DEFINITIONS[timeSlot].label)
      .join(", ");

    return `${item.volunteerName} ya tiene asignación este día en ${timeSlotLabels}. Revisa si debe cubrir ambos horarios.`;
  });

  return {
    warnings,
    repeatedVolunteerIds: repeatedVolunteers.map((item) => item.volunteerId),
    repeatedVolunteers
  };
}

async function assertVolunteersCanServeAsPrimary(volunteerIds: string[]) {
  const uniqueVolunteerIds = [...new Set(volunteerIds)];
  if (!uniqueVolunteerIds.length) return;

  const volunteers = await db.volunteerProfile.findMany({
    where: {
      id: { in: uniqueVolunteerIds }
    },
    select: {
      id: true,
      canServeAsPrimary: true,
      user: {
        select: {
          name: true
        }
      }
    }
  });
  const foundVolunteerIds = new Set(
    volunteers.map((volunteer) => volunteer.id)
  );
  const invalidVolunteerNames = volunteers
    .filter((volunteer) => !volunteer.canServeAsPrimary)
    .map((volunteer) => volunteer.user.name);
  const missingVolunteerIds = uniqueVolunteerIds.filter(
    (volunteerId) => !foundVolunteerIds.has(volunteerId)
  );

  if (invalidVolunteerNames.length || missingVolunteerIds.length) {
    throw new AppError(
      invalidVolunteerNames.length
        ? `No puedes asignar como titular a: ${invalidVolunteerNames.join(", ")}.`
        : "Uno de los voluntarios seleccionados no existe.",
      409
    );
  }
}

async function assertVolunteerCanServeAsReplacement(volunteerId: string) {
  const volunteer = await db.volunteerProfile.findUnique({
    where: { id: volunteerId },
    select: {
      active: true,
      temporaryUnavailable: true,
      canServeAsReplacement: true,
      user: {
        select: {
          name: true,
          active: true,
          accessStatus: true
        }
      }
    }
  });

  if (!volunteer) {
    throw new AppError("No se encontró el voluntario seleccionado.", 404);
  }

  if (
    !volunteer.active ||
    volunteer.temporaryUnavailable ||
    !volunteer.user.active ||
    volunteer.user.accessStatus !== "APPROVED" ||
    !volunteer.canServeAsReplacement
  ) {
    throw new AppError(
      `${volunteer.user.name} no está habilitado como suplente activo.`,
      409
    );
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

function difference(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function getMissingBaseSlotNumbers(input: {
  volunteers: Array<{ slotNumber: number }>;
}) {
  return BASE_ASSIGNMENT_SLOT_NUMBERS.filter(
    (slotNumber) =>
      !input.volunteers.some((volunteer) => volunteer.slotNumber === slotNumber)
  );
}

function getDeclinedSlotNumbers(input: {
  volunteers: Array<{ volunteerId: string; slotNumber: number }>;
  responses: Array<{ volunteerId: string; responseStatus: ResponseStatus }>;
}) {
  return input.responses
    .filter((response) => response.responseStatus === "DECLINED")
    .map((response) => {
      const slot = input.volunteers.find(
        (volunteer) => volunteer.volunteerId === response.volunteerId
      );
      return slot?.slotNumber;
    })
    .filter(
      (slotNumber): slotNumber is number => typeof slotNumber === "number"
    );
}

export function selectReplacementAssignmentSlotNumber(input: {
  volunteers: Array<{ volunteerId: string; slotNumber: number }>;
  responses: Array<{ volunteerId: string; responseStatus: ResponseStatus }>;
}): number | null {
  const [declinedSlotNumber] = getDeclinedSlotNumbers(input);

  if (declinedSlotNumber) {
    return declinedSlotNumber;
  }

  const [missingBaseSlotNumber] = getMissingBaseSlotNumbers(input);

  if (missingBaseSlotNumber) {
    return missingBaseSlotNumber;
  }

  return input.volunteers[input.volunteers.length - 1]?.slotNumber ?? null;
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
  volunteers: Array<{ volunteerId: string; slotNumber: number }>;
  actorUserId: string;
}) {
  const fixedPoint = await getSingletonPreachingPoint();

  await assertPointSupportsSlot({
    preachingPointId: fixedPoint.id,
    dayOfWeek: input.dayOfWeek,
    timeSlot: input.timeSlot,
    allowAllSlots: fixedPoint.name === FIXED_PREACHING_POINT_NAME
  });

  const uniqueVolunteerIds = [
    ...new Set(input.volunteers.map((volunteer) => volunteer.volunteerId))
  ];
  await assertVolunteersCanServeAsPrimary(uniqueVolunteerIds);
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
          slotNumber: volunteer.slotNumber
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

    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId: created.id,
      actorUserId: input.actorUserId,
      event: "ASSIGNED",
      metadata: {
        volunteers: uniqueVolunteerIds,
        source: "assignment_created"
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

  return mapAssignmentDetailWithSameDayWarnings(refreshedAssignment);
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
    volunteers?: Array<{ volunteerId: string; slotNumber: number }>;
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
    timeSlot: nextTimeSlot,
    allowAllSlots: fixedPoint.name === FIXED_PREACHING_POINT_NAME
  });

  await assertNoVolunteerConflicts({
    assignmentId,
    date: nextDate,
    timeSlot: nextTimeSlot,
    volunteerIds
  });

  if (input.volunteers) {
    await assertVolunteersCanServeAsPrimary(nextVolunteerIds);
  }

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
            slotNumber: volunteer.slotNumber
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

    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId,
      actorUserId: input.actorUserId,
      event:
        input.status === "CANCELLED"
          ? "CANCELLED"
          : input.status === "COMPLETED"
            ? "ASSIGNMENT_COVERED"
            : updatedFields.length === 1 && updatedFields[0] === "notes"
              ? "NOTES_UPDATED"
              : "MANUAL_OVERRIDE",
      metadata: {
        updatedFields,
        previousStatus: current.status,
        nextStatus: input.status,
        previousVolunteerIds: input.volunteers
          ? currentVolunteerIds
          : undefined,
        nextVolunteerIds: input.volunteers ? nextVolunteerIds : undefined,
        addedVolunteerIds: input.volunteers ? addedVolunteerIds : undefined,
        removedVolunteerIds: input.volunteers ? removedVolunteerIds : undefined,
        source: "assignment_update"
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

  return mapAssignmentDetailWithSameDayWarnings(assignment);
}

export async function deleteAssignment(assignmentId: string) {
  await db.assignment.delete({ where: { id: assignmentId } });
}

export async function getAssignmentDetail(assignmentId: string) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: assignmentInclude
  });

  return mapAssignmentDetailWithSameDayWarnings(assignment);
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
      timeSlot: input.timeSlot,
      status: getOperationalAssignmentStatusFilter()
    },
    include: assignmentInclude,
    orderBy: [{ preachingPoint: { name: "asc" } }, { pairNumber: "asc" }]
  });

  const sameDayRepeatAssignmentIds = await getSameDayRepeatAssignmentIdsForDate(
    input.date
  );

  return assignments.map((assignment) =>
    mapAssignmentDetail(assignment, { sameDayRepeatAssignmentIds })
  );
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
      status: getOperationalAssignmentStatusFilter(input?.filters?.status)
    },
    include: {
      preachingPoint: true,
      volunteers: {
        orderBy: {
          slotNumber: "asc"
        },
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
  const sameDayRepeatAssignmentIds = getSameDayRepeatAssignmentIds(assignments);

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
        ),
        sameDayRepeat: sameDayRepeatAssignmentIds.has(assignment.id)
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
    weekLabel: formatDateRange(weekStart, weekEnd),
    startDate: weekStart,
    endDate: weekEnd,
    days
  };
}

export async function createScheduleWeek(input: {
  targetWeekStart: Date;
  actorUserId: string;
}): Promise<CreateScheduleWeekResult> {
  const weekStart = normalizeScheduleWeekStart(input.targetWeekStart);
  await assertWeekDoesNotExist(weekStart);

  const week = await db.scheduleWeek.create({
    data: {
      startDate: weekStart,
      endDate: addDays(weekStart, 6),
      label: formatDateRange(weekStart, addDays(weekStart, 6)),
      createdById: input.actorUserId
    }
  });

  await recordAutomationAuditLog({
    eventType: "WEEK_CREATED",
    scheduleWeekId: week.id,
    actorUserId: input.actorUserId,
    metadata: {
      source: "manual_week_create",
      startDate: week.startDate,
      endDate: week.endDate
    }
  });

  const automation = await prepareScheduleWeekAutomation({
    scheduleWeekId: week.id,
    actorUserId: input.actorUserId
  });

  return {
    week,
    automation
  };
}

export async function duplicateScheduleWeek(input: {
  sourceWeekId: string;
  targetWeekStart: Date;
  actorUserId: string;
  onExisting?: DuplicateScheduleWeekOnExisting;
  sendInvitations?: boolean;
  source?: DuplicateScheduleWeekSource;
  automationRunId?: string;
}): Promise<DuplicateScheduleWeekResult> {
  const onExisting = input.onExisting ?? "throw";
  const sendInvitations = input.sendInvitations ?? true;
  const duplicateSource = input.source ?? "week_duplicate";
  const { startDate: weekStart, endDate: weekEnd } = getScheduleWeekRange(
    input.targetWeekStart
  );

  const sourceWeek = await db.scheduleWeek.findUniqueOrThrow({
    where: { id: input.sourceWeekId },
    include: {
      assignments: {
        where: {
          status: {
            not: "CANCELLED"
          }
        },
        include: {
          volunteers: true
        },
        orderBy: [
          {
            date: "asc"
          },
          {
            timeSlot: "asc"
          },
          {
            pairNumber: "asc"
          }
        ]
      }
    }
  });
  const fixedPoint = await getSingletonPreachingPoint();
  const titularVolunteerIds = getUniqueIds(
    sourceWeek.assignments.flatMap((assignment) =>
      assignment.volunteers
        .filter((volunteer) => !volunteer.isReplacement)
        .map((volunteer) => volunteer.volunteerId)
    )
  );

  await assertVolunteersCanServeAsPrimary(titularVolunteerIds);

  for (const assignment of sourceWeek.assignments) {
    await assertPointSupportsSlot({
      preachingPointId: fixedPoint.id,
      dayOfWeek: assignment.dayOfWeek,
      timeSlot: assignment.timeSlot,
      allowAllSlots: fixedPoint.name === FIXED_PREACHING_POINT_NAME
    });
  }

  const duplication = await db.$transaction(async (tx) => {
    const existingWeek = await tx.scheduleWeek.findUnique({
      where: {
        startDate_endDate: {
          startDate: weekStart,
          endDate: weekEnd
        }
      }
    });

    if (existingWeek) {
      if (onExisting === "skip") {
        return {
          week: existingWeek,
          created: false,
          assignmentCount: 0,
          createdAssignmentIds: [],
          skippedReason: "existing_week" as const
        };
      }

      throw new AppError(
        `Ya existe una semana creada para el ${weekStart.toLocaleDateString("es-MX")}.`,
        409
      );
    }

    const targetWeek = await tx.scheduleWeek.create({
      data: {
        startDate: weekStart,
        endDate: weekEnd,
        label: formatDateRange(weekStart, weekEnd),
        createdById: input.actorUserId
      }
    });
    const createdAssignmentIds: string[] = [];

    await recordAutomationAuditLog({
      client: tx,
      eventType: "WEEK_CREATED",
      scheduleWeekId: targetWeek.id,
      actorUserId: input.actorUserId,
      automationRunId: input.automationRunId,
      metadata: {
        source: duplicateSource,
        sourceWeekId: sourceWeek.id,
        targetWeekId: targetWeek.id,
        startDate: targetWeek.startDate,
        endDate: targetWeek.endDate
      }
    });

    for (const assignment of sourceWeek.assignments) {
      const newDate = addDays(
        weekStart,
        differenceInCalendarDays(assignment.date, sourceWeek.startDate)
      );
      const titularVolunteers = assignment.volunteers
        .filter((volunteer) => !volunteer.isReplacement)
        .sort((left, right) => left.slotNumber - right.slotNumber);
      const uniqueAssignmentVolunteerIds = getUniqueIds(
        titularVolunteers.map((volunteer) => volunteer.volunteerId)
      );
      const created = await tx.assignment.create({
        data: {
          scheduleWeekId: targetWeek.id,
          date: newDate,
          dayOfWeek: assignment.dayOfWeek,
          timeSlot: assignment.timeSlot,
          preachingPointId: fixedPoint.id,
          pairNumber: assignment.pairNumber,
          notes: assignment.notes,
          status: "SCHEDULED"
        }
      });

      createdAssignmentIds.push(created.id);

      if (titularVolunteers.length) {
        await tx.assignmentVolunteer.createMany({
          data: titularVolunteers.map((volunteer) => ({
            assignmentId: created.id,
            volunteerId: volunteer.volunteerId,
            slotNumber: volunteer.slotNumber
          }))
        });

        await syncResponses({
          tx,
          assignmentId: created.id,
          volunteerIds: uniqueAssignmentVolunteerIds
        });

        await createPendingPrimaryInvitationsForAssignment({
          tx,
          assignmentId: created.id,
          volunteerIds: uniqueAssignmentVolunteerIds,
          actorUserId: input.actorUserId,
          source: "week_duplicate",
          metadata: {
            source: duplicateSource,
            sourceAssignmentId: assignment.id,
            sourceWeekId: sourceWeek.id,
            targetWeekId: targetWeek.id,
            automationRunId: input.automationRunId
          }
        });
      }

      await recordAssignmentAuditActivity({
        client: tx,
        assignmentId: created.id,
        actorUserId: input.actorUserId,
        event: "ASSIGNED",
        metadata: {
          volunteers: uniqueAssignmentVolunteerIds,
          source: duplicateSource,
          sourceAssignmentId: assignment.id,
          sourceWeekId: sourceWeek.id,
          targetWeekId: targetWeek.id,
          automationRunId: input.automationRunId
        }
      });

      await recalculateAssignmentStatus(created.id, tx);
    }

    return {
      week: targetWeek,
      created: true,
      assignmentCount: createdAssignmentIds.length,
      createdAssignmentIds
    };
  });

  const automation = duplication.created
    ? await prepareScheduleWeekAutomation({
        scheduleWeekId: duplication.week.id,
        actorUserId: input.actorUserId,
        sendEmails: sendInvitations,
        automationRunId: input.automationRunId
      })
    : null;

  return {
    week: duplication.week,
    created: duplication.created,
    assignmentCount: duplication.assignmentCount,
    primaryInvitations: automation?.primaryInvitations,
    replacementCensus: automation?.replacementCensus,
    skippedReason:
      "skippedReason" in duplication ? duplication.skippedReason : undefined
  };
}

export type AutoPrepareUpcomingScheduleWeeksResult = {
  status: "completed" | "skipped";
  processedCount: number;
  skippedCount: number;
  createdCount: number;
  existingCount: number;
  assignmentCount: number;
  detail?: string;
};

export async function autoPrepareUpcomingScheduleWeeks(input?: {
  now?: Date;
  actorUserId?: string;
  automationRunId?: string;
}): Promise<AutoPrepareUpcomingScheduleWeeksResult> {
  const settings = await getAppSettings();

  if (!settings.autoPrepareNextWeekEnabled) {
    return {
      status: "skipped",
      processedCount: 0,
      skippedCount: 0,
      createdCount: 0,
      existingCount: 0,
      assignmentCount: 0,
      detail: "Auto-preparación semanal desactivada."
    };
  }

  const now = input?.now ?? new Date();
  const currentWeekStart = normalizeScheduleWeekStart(now);
  const weeksAhead = settings.autoPrepareWeeksAhead;
  let createdCount = 0;
  let existingCount = 0;
  let skippedCount = 0;
  let assignmentCount = 0;

  for (let index = 1; index <= weeksAhead; index += 1) {
    const targetWeekStart = addDays(currentWeekStart, index * 7);
    const { startDate, endDate } = getScheduleWeekRange(targetWeekStart);
    const existingWeek = await db.scheduleWeek.findUnique({
      where: {
        startDate_endDate: {
          startDate,
          endDate
        }
      },
      select: {
        id: true
      }
    });

    if (existingWeek) {
      existingCount += 1;
      continue;
    }

    const sourceWeek = await getRecommendedSourceWeekForTarget({
      targetWeekStart,
      requireAssignments: true
    });

    if (!sourceWeek) {
      skippedCount += 1;
      await recordAutomationAuditLog({
        eventType: "WEEK_CREATED",
        status: "SKIPPED",
        actorUserId: input?.actorUserId,
        automationRunId: input?.automationRunId,
        metadata: {
          source: "auto_week_rollover",
          reason: "missing_source_week",
          targetWeekStart: startDate,
          targetWeekEnd: endDate
        }
      });
      continue;
    }

    const result = await duplicateScheduleWeek({
      sourceWeekId: sourceWeek.id,
      targetWeekStart,
      actorUserId: input?.actorUserId ?? sourceWeek.createdById,
      onExisting: "skip",
      sendInvitations: true,
      source: "auto_week_rollover",
      automationRunId: input?.automationRunId
    });

    if (result.created) {
      createdCount += 1;
      assignmentCount += result.assignmentCount;
    } else {
      existingCount += 1;
    }
  }

  return {
    status: "completed",
    processedCount: weeksAhead,
    skippedCount,
    createdCount,
    existingCount,
    assignmentCount
  };
}

async function assertVolunteerCanRespondToAssignment(input: {
  tx: Prisma.TransactionClient;
  assignmentId: string;
  volunteerProfileId: string;
}) {
  const assignedVolunteer = await input.tx.assignmentVolunteer.findUnique({
    where: {
      assignmentId_volunteerId: {
        assignmentId: input.assignmentId,
        volunteerId: input.volunteerProfileId
      }
    },
    select: {
      id: true
    }
  });

  if (!assignedVolunteer) {
    throw new AppError("No puedes responder esta asignación.", 403);
  }
}

export async function confirmAssignment(input: {
  assignmentId: string;
  volunteerProfileId: string;
  note?: string;
}) {
  const now = new Date();
  const assignment = await db.$transaction(async (tx) => {
    await assertVolunteerCanRespondToAssignment({
      tx,
      assignmentId: input.assignmentId,
      volunteerProfileId: input.volunteerProfileId
    });

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

    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId: input.assignmentId,
      event: "RESPONSE_RECEIVED",
      metadata: {
        volunteerProfileId: input.volunteerProfileId,
        responseStatus: "CONFIRMED",
        note: input.note,
        source: "assignment_response"
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

  return mapAssignmentDetailWithSameDayWarnings(assignment);
}

export async function declineAssignment(input: {
  assignmentId: string;
  volunteerProfileId: string;
  note?: string;
}) {
  const now = new Date();
  const assignment = await db.$transaction(async (tx) => {
    await assertVolunteerCanRespondToAssignment({
      tx,
      assignmentId: input.assignmentId,
      volunteerProfileId: input.volunteerProfileId
    });

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

    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId: input.assignmentId,
      event: "RESPONSE_RECEIVED",
      metadata: {
        volunteerProfileId: input.volunteerProfileId,
        responseStatus: "DECLINED",
        note: input.note,
        source: "assignment_response"
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

  return mapAssignmentDetailWithSameDayWarnings(assignment);
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

    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId: input.assignmentId,
      event: "REPLACEMENT_REQUIRED",
      dedupeKey: `replacement-required:${input.id}`,
      metadata: {
        reason: "invitation_expired",
        invitationId: input.id,
        invitationType: input.type,
        volunteerProfileId: input.volunteerId,
        source: "response_attempt_after_expiration",
        expiredAt
      }
    });

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
      const targetSlotNumber = selectReplacementAssignmentSlotNumber({
        volunteers: currentAssignment.volunteers,
        responses: currentAssignment.responses
      });

      if (!targetSlotNumber) {
        throw new AppError(
          "No se encontró un espacio disponible para asignar el reemplazo.",
          400
        );
      }

      const existingSlot = currentAssignment.volunteers.find(
        (slot) => slot.slotNumber === targetSlotNumber
      );
      const existingReplacementSlot = currentAssignment.volunteers.find(
        (slot) => slot.volunteerId === invitation.volunteerId
      );

      if (
        existingReplacementSlot &&
        existingReplacementSlot.id !== existingSlot?.id
      ) {
        await tx.assignmentVolunteer.delete({
          where: { id: existingReplacementSlot.id }
        });
      }

      if (existingSlot && existingSlot.volunteerId !== invitation.volunteerId) {
        await tx.assignmentVolunteer.delete({
          where: { id: existingSlot.id }
        });
        await tx.assignmentResponse.deleteMany({
          where: {
            assignmentId: invitation.assignmentId,
            volunteerId: existingSlot.volunteerId
          }
        });
      }

      if (existingSlot?.volunteerId === invitation.volunteerId) {
        await tx.assignmentVolunteer.update({
          where: { id: existingSlot.id },
          data: {
            slotNumber: targetSlotNumber,
            isReplacement: true
          }
        });
      } else {
        await tx.assignmentVolunteer.create({
          data: {
            assignmentId: invitation.assignmentId,
            volunteerId: invitation.volunteerId,
            slotNumber: targetSlotNumber,
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
            assignedSlotNumber: targetSlotNumber
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
          assignedSlotNumber: targetSlotNumber
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

      await recordAssignmentAuditActivity({
        client: tx,
        assignmentId: invitation.assignmentId,
        event: "REPLACEMENT_ASSIGNED",
        metadata: {
          volunteerProfileId: invitation.volunteerId,
          invitationId: invitation.id,
          slotNumber: targetSlotNumber,
          source: "PUBLIC_INVITATION_LINK",
          note: input.note
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

    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId: invitation.assignmentId,
      event: "RESPONSE_RECEIVED",
      metadata: {
        volunteerProfileId: invitation.volunteerId,
        responseStatus: input.responseStatus,
        note: input.note,
        invitationId: invitation.id,
        invitationType: invitation.type,
        source: "PUBLIC_INVITATION_LINK",
        replacementAutomationPending: input.responseStatus === "DECLINED"
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

  return mapAssignmentDetailWithSameDayWarnings(assignment);
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
      canServeAsPrimary: true,
      temporaryUnavailable: false,
      user: { active: true, accessStatus: "APPROVED" },
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
          assignment.volunteers.length < MIN_ASSIGNMENT_VOLUNTEERS
      )
      .map(async (assignment) => {
        const missingSlotNumbers = getMissingBaseSlotNumbers({
          volunteers: assignment.volunteers
        });
        const declinedSlotNumbers = getDeclinedSlotNumbers({
          volunteers: assignment.volunteers,
          responses: assignment.responses
        });
        const slotNumbers = [
          ...new Set([...missingSlotNumbers, ...declinedSlotNumbers])
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
          missingSlotNumbers: slotNumbers.length ? slotNumbers : [2],
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
  slotNumber?: number;
  requireOpenSlot?: boolean;
}) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: input.assignmentId },
    include: {
      volunteers: true,
      responses: true,
      preachingPoint: true
    }
  });

  const openSlotNumbers = [
    ...new Set([
      ...getMissingBaseSlotNumbers({ volunteers: assignment.volunteers }),
      ...getDeclinedSlotNumbers({
        volunteers: assignment.volunteers,
        responses: assignment.responses
      })
    ])
  ];

  if (input.requireOpenSlot && !openSlotNumbers.length) {
    throw new AppError("Esta asignación no tiene una vacante disponible.", 409);
  }

  if (
    input.requireOpenSlot &&
    input.slotNumber &&
    !openSlotNumbers.includes(input.slotNumber)
  ) {
    throw new AppError("El espacio seleccionado no está vacante.", 409);
  }

  await assertVolunteerCanServeAsReplacement(input.volunteerId);

  await assertNoVolunteerConflicts({
    assignmentId: input.assignmentId,
    date: assignment.date,
    timeSlot: assignment.timeSlot,
    volunteerIds: [input.volunteerId]
  });

  const targetSlotNumber =
    input.slotNumber ??
    selectReplacementAssignmentSlotNumber({
      volunteers: assignment.volunteers,
      responses: assignment.responses
    });

  if (!targetSlotNumber) {
    throw new AppError(
      "No se encontró un espacio disponible para el voluntario.",
      400
    );
  }

  const result = await db.$transaction(async (tx) => {
    const existingSlot = assignment.volunteers.find(
      (slot) => slot.slotNumber === targetSlotNumber
    );

    if (existingSlot) {
      await tx.assignmentVolunteer.delete({
        where: { id: existingSlot.id }
      });
      await tx.assignmentResponse.deleteMany({
        where: {
          assignmentId: input.assignmentId,
          volunteerId: existingSlot.volunteerId
        }
      });
    }

    await tx.assignmentVolunteer.create({
      data: {
        assignmentId: input.assignmentId,
        volunteerId: input.volunteerId,
        slotNumber: targetSlotNumber,
        isReplacement: true
      }
    });

    await syncResponses({
      tx,
      assignmentId: input.assignmentId,
      volunteerIds: [
        ...assignment.volunteers
          .filter((slot) => slot.slotNumber !== targetSlotNumber)
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

    await recordAssignmentAuditActivity({
      client: tx,
      assignmentId: input.assignmentId,
      actorUserId: input.actorUserId,
      event: "REPLACEMENT_ASSIGNED",
      metadata: {
        volunteerProfileId: input.volunteerId,
        slotNumber: targetSlotNumber,
        source: "manual_replacement_assignment"
      }
    });

    await recalculateAssignmentStatus(input.assignmentId, tx);

    return tx.assignment.findUniqueOrThrow({
      where: { id: input.assignmentId },
      include: assignmentInclude
    });
  });

  return mapAssignmentDetailWithSameDayWarnings(result);
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
        },
        status: getOperationalAssignmentStatusFilter()
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

  const details = mapAssignmentDetails(assignments);
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
    weekLabel: formatDateRange(weekStart, weekEnd),
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
      responseRate: safePercentage(
        submittedCensusResponses,
        totalCensusResponses
      )
    },
    alerts: {
      failedEmails,
      expiredPrimaryInvitations,
      expiredReplacementInvitations,
      uncoveredAssignments: requiresAttention.length
    },
    todaysAssignments: details.filter((assignment) =>
      isSameDay(assignment.date, today)
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

  return mapAssignmentDetails(assignments);
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
        orderBy: {
          slotNumber: "asc"
        },
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
      status: getOperationalAssignmentStatusFilter(input?.status),
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

  return mapAssignmentDetails(assignments);
}
