import { randomUUID } from "node:crypto";

import {
  addHours,
  startOfDay,
  startOfWeek,
  subDays,
  subHours
} from "date-fns";
import { Prisma } from "@prisma/client";
import type {
  Assignment,
  AssignmentInvitation,
  AssignmentInvitationType,
  NotificationType,
  TimeSlot
} from "@prisma/client";

import { db } from "@/lib/db/prisma";
import {
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS
} from "@/lib/constants/domain";
import {
  DEFAULT_FINAL_REMINDER_HOURS,
  DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS,
  DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_REPLACEMENT_REMINDER_OFFSETS_HOURS,
  DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_PRIMARY_REMINDER_OFFSETS_HOURS,
  DEFAULT_URGENT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_REPLACEMENT_REMINDER_OFFSETS_HOURS,
  DEFAULT_URGENT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_THRESHOLD_HOURS
} from "@/lib/constants/app";
import { buildAssignmentStartDate } from "@/lib/assignments/time";
import {
  normalizePositiveHourSetting,
  normalizeReminderOffsetsHours
} from "@/lib/assignments/invitation-timing";
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";
import { formatDisplayDate } from "@/lib/utils";
import {
  ACTIVE_ASSIGNMENT_INVITATION_STATUSES,
  buildAssignmentInvitationResponseUrl,
  createPendingReplacementInvitationForAssignment,
  sendPendingReplacementInvitationsForAssignment,
  sendPendingPrimaryInvitationsForAssignment
} from "@/services/assignment-invitation.service";
import {
  getReplacementCandidatesForAssignment,
  selectNextReplacementCandidateForAssignment
} from "@/services/replacement-candidate.service";
import { sendEmailNotification } from "@/services/notification.service";
import {
  buildAdminAssignmentAlertEmail,
  buildAssignmentReminderEmail,
  buildReplacementCensusReminderEmail,
  type AdminAssignmentAlertEmailInput,
  type AdminAssignmentAlertReason
} from "@/services/email-template.service";
import {
  getAssignmentAutomationSettings,
  type AssignmentAutomationSettings
} from "@/services/setting.service";
import { getAppBaseUrl } from "@/lib/env/config";
import { recordAssignmentAuditActivity } from "@/services/assignment-audit.service";
import {
  createAdminAppNotifications,
  createAdminAssignmentAppNotifications,
  createAppNotificationOnce
} from "@/services/app-notification.service";
import {
  buildReplacementCensusResponseUrl,
  openReplacementCensusForWeek,
  sendPendingReplacementCensusInvitations
} from "@/services/replacement-census.service";

export {
  buildAdminAssignmentAlertEmail
} from "@/services/email-template.service";
export { buildAssignmentStartDate } from "@/lib/assignments/time";
export type {
  AdminAssignmentAlertEmailInput,
  AdminAssignmentAlertReason
} from "@/services/email-template.service";

const TERMINAL_ASSIGNMENT_STATUSES = ["CANCELLED", "COMPLETED"] as const;
const AUTOMATION_BATCH_SIZE = 50;
const CENSUS_REMINDER_HOURS_BEFORE_CLOSE = 24;
const AUTOMATION_LAST_RUN_SETTING_KEY = "assignmentAutomationLastRun";

type AutomationStepStatus = "completed" | "skipped" | "failed";

export type AssignmentAutomationStepResult = {
  status: AutomationStepStatus;
  processedCount: number;
  skippedCount: number;
  detail?: string;
};

export type SendPendingPrimaryInvitationsResult =
  AssignmentAutomationStepResult & {
    sentCount: number;
    failedCount: number;
  };

export type ExpireTimedOutInvitationsResult =
  AssignmentAutomationStepResult & {
    expiredCount: number;
    reconciledCount: number;
    replacementRequiredCount: number;
  };

export type ProcessAssignmentsNeedingReplacementResult =
  AssignmentAutomationStepResult & {
    markedCount: number;
    alreadyMarkedCount: number;
  };

export type ReplacementCandidateSelectionResult =
  AssignmentAutomationStepResult & {
    invitedCount: number;
    sentCount: number;
    failedCount: number;
    unresolvedCount: number;
    activeInvitationCount: number;
  };

export type ReplacementInvitationResult = {
  assignmentId: string;
  status: "invited" | "no_candidate" | "active_invitation" | "skipped";
  candidateId?: string;
  sentCount: number;
  failedCount: number;
};

export type SendDueAssignmentRemindersResult = AssignmentAutomationStepResult & {
  sentCount: number;
  failedCount: number;
  duplicateCount: number;
};

export type NotifyAdminsForUnresolvedAssignmentsResult =
  AssignmentAutomationStepResult & {
    alertedCount: number;
    sentCount: number;
    failedCount: number;
    duplicateCount: number;
  };

export type OpenWeeklyReplacementCensusResult = AssignmentAutomationStepResult & {
  openedCount: number;
  existingOpenCount: number;
  replacementCount: number;
  createdResponseCount: number;
  skippedResponseCount: number;
};

export type SendReplacementCensusInvitationsResult =
  AssignmentAutomationStepResult & {
    sentCount: number;
    failedCount: number;
  };

export type SendReplacementCensusRemindersResult =
  AssignmentAutomationStepResult & {
    sentCount: number;
    failedCount: number;
    duplicateCount: number;
  };

export type CloseExpiredReplacementCensusResult =
  AssignmentAutomationStepResult & {
    closedCount: number;
    expiredResponseCount: number;
    readNotificationCount: number;
  };

export type CreateDueAppNotificationsResult = AssignmentAutomationStepResult & {
  createdCount: number;
  duplicateCount: number;
};

export type AssignmentAutomationRunResult = {
  automationRunId: string;
  status: "completed" | "completed_with_errors";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  failedStepCount: number;
  summarySaved: boolean;
  summaryError?: string;
  sendPendingPrimaryInvitations: SendPendingPrimaryInvitationsResult;
  sendPrimaryResponseReminders: SendDueAssignmentRemindersResult;
  expireTimedOutPrimaryInvitations: ExpireTimedOutInvitationsResult;
  openWeeklyReplacementCensus: OpenWeeklyReplacementCensusResult;
  sendReplacementCensusInvitations: SendReplacementCensusInvitationsResult;
  sendReplacementCensusReminders: SendReplacementCensusRemindersResult;
  closeExpiredReplacementCensus: CloseExpiredReplacementCensusResult;
  processAssignmentsNeedingReplacement: ProcessAssignmentsNeedingReplacementResult;
  inviteNextAvailableReplacement: ReplacementCandidateSelectionResult;
  sendReplacementResponseReminders: SendDueAssignmentRemindersResult;
  expireTimedOutReplacementInvitations: ExpireTimedOutInvitationsResult;
  sendDueAssignmentReminders: SendDueAssignmentRemindersResult;
  createDueAppNotifications: CreateDueAppNotificationsResult;
  notifyAdminsForUnresolvedAssignments: NotifyAdminsForUnresolvedAssignmentsResult;
};

type ExpirableInvitation = AssignmentInvitation & {
  assignment: Pick<Assignment, "id" | "status">;
};

type AssignmentReminderKind =
  | "DAYS_BEFORE"
  | "FINAL_HOURS"
  | "PENDING_CONFIRMATION";

type DueAssignmentReminder = {
  kind: AssignmentReminderKind;
  reminderKey: string;
  notificationType: NotificationType;
  targetAt: Date;
  offsetDays?: number;
  offsetHours?: number;
};

type AssignmentReminderRecipient = {
  assignmentId: string;
  volunteerProfileId: string;
  volunteerUserId: string;
  volunteerName: string;
  assignmentDate: Date;
  assignmentStartAt: Date;
  dayOfWeek: Assignment["dayOfWeek"];
  timeSlot: TimeSlot;
  reminder: DueAssignmentReminder;
  responseUrl?: string;
  invitationId?: string;
  invitationType?: AssignmentInvitationType;
};

type AdminAssignmentAlertDeliveryResult = {
  sentCount: number;
  failedCount: number;
  skipped: boolean;
};

type AssignmentAutomationRunInput = {
  now?: Date;
  automationRunId?: string;
  actorUserId?: string;
};

function asMetadataObject(value: Prisma.JsonValue | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function compactMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
}

function mergeMetadata(
  current: Prisma.JsonValue | null,
  next: Record<string, unknown>
) {
  return compactMetadata({
    ...asMetadataObject(current),
    ...next
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado durante la automatización.";
}

function mergeRunMetadata(
  metadata: Record<string, unknown>,
  automationRunId?: string
) {
  return compactMetadata({
    ...metadata,
    automationRunId
  });
}

async function runAutomationStep<T extends AssignmentAutomationStepResult>(
  execute: () => Promise<T>,
  fallback: Omit<T, "status" | "detail">
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    return {
      ...fallback,
      status: "failed",
      detail: getErrorMessage(error)
    } as T;
  }
}

async function saveAssignmentAutomationRunSummary(
  result: AssignmentAutomationRunResult
) {
  await db.appSetting.upsert({
    where: {
      key: AUTOMATION_LAST_RUN_SETTING_KEY
    },
    update: {
      value: result as unknown as Prisma.InputJsonValue
    },
    create: {
      key: AUTOMATION_LAST_RUN_SETTING_KEY,
      value: result as unknown as Prisma.InputJsonValue
    }
  });
}

function getMetadataNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const numbers = value.filter(
    (item): item is number => typeof item === "number"
  );

  return numbers.length ? numbers : null;
}

function getPrimaryPendingReminderOffsets(input: {
  invitationMetadata: Prisma.JsonValue | null;
  settings: AssignmentAutomationSettings;
}) {
  const metadata = asMetadataObject(input.invitationMetadata);
  const metadataOffsets = getMetadataNumberArray(
    metadata.primaryReminderOffsetsHours
  );

  return normalizeReminderOffsetsHours(
    metadataOffsets ?? input.settings.primaryReminderOffsetsHours,
    DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS
  );
}

function getReplacementPendingReminderOffsets(input: {
  invitationMetadata: Prisma.JsonValue | null;
  settings: AssignmentAutomationSettings;
}) {
  const metadata = asMetadataObject(input.invitationMetadata);
  const metadataOffsets = getMetadataNumberArray(
    metadata.replacementReminderOffsetsHours
  );

  return normalizeReminderOffsetsHours(
    metadataOffsets ?? input.settings.replacementReminderOffsetsHours,
    DEFAULT_REPLACEMENT_REMINDER_OFFSETS_HOURS
  );
}

function isTerminalAssignment(status: Assignment["status"]) {
  return TERMINAL_ASSIGNMENT_STATUSES.includes(
    status as (typeof TERMINAL_ASSIGNMENT_STATUSES)[number]
  );
}

export function normalizeReminderTimingDays(days: number[]) {
  return [...new Set(days)]
    .filter((daysBefore) => Number.isInteger(daysBefore) && daysBefore > 0)
    .sort((left, right) => left - right);
}

export function getDueConfirmedAssignmentReminder(input: {
  assignmentDate: Date;
  timeSlot: TimeSlot;
  now: Date;
  reminderTimingDays: number[];
  finalReminderHours: number;
  confirmedAt?: Date | null;
}): DueAssignmentReminder | null {
  const assignmentStartAt = buildAssignmentStartDate({
    date: input.assignmentDate,
    timeSlot: input.timeSlot
  });

  if (assignmentStartAt <= input.now) {
    return null;
  }

  const activeFrom = input.confirmedAt;
  const dueReminders: DueAssignmentReminder[] = [];

  if (input.finalReminderHours > 0) {
    const targetAt = subHours(assignmentStartAt, input.finalReminderHours);
    if (targetAt <= input.now && (!activeFrom || targetAt >= activeFrom)) {
      dueReminders.push({
        kind: "FINAL_HOURS",
        reminderKey: `confirmed-final-${input.finalReminderHours}h`,
        notificationType: "FINAL_REMINDER",
        targetAt,
        offsetHours: input.finalReminderHours
      });
    }
  }

  for (const daysBefore of normalizeReminderTimingDays(input.reminderTimingDays)) {
    const targetAt = subDays(assignmentStartAt, daysBefore);

    if (targetAt <= input.now && (!activeFrom || targetAt >= activeFrom)) {
      dueReminders.push({
        kind: "DAYS_BEFORE",
        reminderKey: `confirmed-${daysBefore}d`,
        notificationType: "REMINDER",
        targetAt,
        offsetDays: daysBefore
      });
    }
  }

  if (!dueReminders.length) {
    return null;
  }

  return dueReminders.sort(
    (left, right) => right.targetAt.getTime() - left.targetAt.getTime()
  )[0];
}

export function getDuePendingConfirmationReminder(input: {
  invitationId: string;
  sentAt: Date;
  expiresAt: Date;
  now: Date;
  reminderOffsetsHours: number[];
  fallbackReminderOffsetsHours?: readonly number[];
}): DueAssignmentReminder | null {
  if (input.expiresAt <= input.now) {
    return null;
  }

  const dueOffsets = normalizeReminderOffsetsHours(
    input.reminderOffsetsHours,
    input.fallbackReminderOffsetsHours ?? DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS
  ).filter((offsetHours) => {
    const targetAt = addHours(input.sentAt, offsetHours);
    return targetAt <= input.now && targetAt < input.expiresAt;
  });
  const offsetHours = dueOffsets[dueOffsets.length - 1];

  if (!offsetHours) {
    return null;
  }

  const targetAt = addHours(input.sentAt, offsetHours);

  return {
    kind: "PENDING_CONFIRMATION",
    reminderKey: `pending-confirmation-${input.invitationId}-${offsetHours}h`,
    notificationType: "REMINDER",
    targetAt,
    offsetHours
  };
}

function uniqueNames(names: string[]) {
  return [...new Set(names.filter((name) => name.trim().length > 0))];
}

function getAdminAssignmentUrl(assignmentId: string) {
  return `${getAppBaseUrl()}/admin/assignments/${encodeURIComponent(
    assignmentId
  )}`;
}

function getAdminAlertAppNotificationType(reason: AdminAssignmentAlertReason) {
  return reason === "INVITATION_EMAIL_FAILED"
    ? ("EMAIL_FAILED" as const)
    : ("REPLACEMENT_NEEDED" as const);
}

function getAdminAlertAppNotificationTitle(reason: AdminAssignmentAlertReason) {
  return reason === "INVITATION_EMAIL_FAILED"
    ? "Email crítico fallido"
    : "Sin suplentes disponibles";
}

async function hasReplacementRequiredActivity(
  assignmentId: string,
  tx: Prisma.TransactionClient
) {
  const existingActivity = await tx.assignmentActivity.findFirst({
    where: {
      assignmentId,
      actionType: "REPLACEMENT_REQUIRED"
    },
    select: {
      id: true
    }
  });

  return Boolean(existingActivity);
}

async function createReplacementRequiredActivityOnce(input: {
  assignmentId: string;
  tx: Prisma.TransactionClient;
  reason: string;
  invitationId?: string;
  volunteerProfileId?: string;
  automationRunId?: string;
}) {
  const alreadyLogged = await hasReplacementRequiredActivity(
    input.assignmentId,
    input.tx
  );

  if (alreadyLogged) {
    return false;
  }

  await input.tx.assignmentActivity.create({
    data: {
      assignmentId: input.assignmentId,
      actionType: "REPLACEMENT_REQUIRED",
      metadata: compactMetadata({
        reason: input.reason,
        invitationId: input.invitationId,
        volunteerProfileId: input.volunteerProfileId,
        automationRunId: input.automationRunId,
        automationModule: "assignment_automation"
      })
    }
  });

  return true;
}

async function createNoReplacementAvailableActivityOnce(input: {
  assignmentId: string;
  tx: Prisma.TransactionClient;
  automationRunId?: string;
}) {
  const existingActivity = await input.tx.assignmentActivity.findFirst({
    where: {
      assignmentId: input.assignmentId,
      actionType: "NO_REPLACEMENT_AVAILABLE"
    },
    select: {
      id: true
    }
  });

  if (existingActivity) {
    return false;
  }

  await recordAssignmentAuditActivity({
    client: input.tx,
    assignmentId: input.assignmentId,
    event: "NO_REPLACEMENT_AVAILABLE",
    dedupeKey: `no-replacement-available:${input.assignmentId}`,
    metadata: {
      reason: "no_eligible_replacement_candidate",
      automationRunId: input.automationRunId
    }
  });

  return true;
}

async function hasAdminAlerted(input: {
  assignmentId: string;
  alertKey: string;
  legacyReason?: AdminAssignmentAlertReason;
}) {
  const alert = await db.assignmentActivity.findFirst({
    where: {
      assignmentId: input.assignmentId,
      actionType: "ADMIN_ALERTED",
      metadata: {
        path: ["alertKey"],
        equals: input.alertKey
      }
    },
    select: {
      id: true
    }
  });

  if (alert) {
    return true;
  }

  if (!input.legacyReason) {
    return false;
  }

  const legacyAlert = await db.assignmentActivity.findFirst({
    where: {
      assignmentId: input.assignmentId,
      actionType: "ADMIN_ALERTED",
      metadata: {
        path: ["reason"],
        equals: input.legacyReason
      }
    },
    select: {
      id: true
    }
  });

  return Boolean(legacyAlert);
}

async function alertAdminsForAssignment(input: {
  assignmentId: string;
  alertKey: string;
  reason: AdminAssignmentAlertReason;
  reasonLabel: string;
  failedInvitation?: {
    id: string;
    type: AssignmentInvitationType;
    volunteerProfileId: string;
    volunteerName: string;
    errorMessage?: string;
  };
  automationRunId?: string;
}): Promise<AdminAssignmentAlertDeliveryResult> {
  const alreadyAlerted = await hasAdminAlerted({
    assignmentId: input.assignmentId,
    alertKey: input.alertKey,
    legacyReason:
      input.reason === "NO_REPLACEMENT_AVAILABLE" ? input.reason : undefined
  });

  if (alreadyAlerted) {
    return {
      sentCount: 0,
      failedCount: 0,
      skipped: true
    };
  }

  const [assignment, admins] = await Promise.all([
    db.assignment.findUniqueOrThrow({
      where: {
        id: input.assignmentId
      },
      include: {
        preachingPoint: true,
        volunteers: {
          include: {
            volunteer: {
              include: {
                user: true
              }
            }
          }
        },
        invitations: {
          where: {
            type: "REPLACEMENT"
          },
          include: {
            volunteer: {
              include: {
                user: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    }),
    db.user.findMany({
      where: {
        role: "ADMIN",
        active: true
      }
    })
  ]);

  if (input.reason === "NO_REPLACEMENT_AVAILABLE") {
    await db.$transaction(async (tx) => {
      await createNoReplacementAvailableActivityOnce({
        assignmentId: input.assignmentId,
        tx,
        automationRunId: input.automationRunId
      });
    });
  }

  const dateLabel = formatDisplayDate(
    assignment.date,
    "EEEE d 'de' MMMM"
  );
  const timeSlotLabel = TIME_SLOT_DEFINITIONS[assignment.timeSlot].label;
  const originalVolunteerNames = uniqueNames(
    assignment.volunteers
      .filter((slot) => !slot.isReplacement)
      .map((slot) => slot.volunteer.user.name)
  );
  const attemptedReplacementNames = uniqueNames(
    assignment.invitations.map((invitation) => invitation.volunteer.user.name)
  );
  const assignmentUrl = getAdminAssignmentUrl(input.assignmentId);
  const email = buildAdminAssignmentAlertEmail({
    reason: input.reason,
    reasonLabel: input.reasonLabel,
    dateLabel,
    timeSlotLabel,
    pointName: assignment.preachingPoint.name ?? FIXED_PREACHING_POINT_NAME,
    originalVolunteerNames,
    attemptedReplacementNames,
    assignmentUrl,
    affectedVolunteerName: input.failedInvitation?.volunteerName,
    invitationType: input.failedInvitation?.type,
    errorMessage: input.failedInvitation?.errorMessage
  });
  await createAdminAssignmentAppNotifications({
    admins,
    assignmentId: input.assignmentId,
    type: getAdminAlertAppNotificationType(input.reason),
    priority: "URGENT",
    title: getAdminAlertAppNotificationTitle(input.reason),
    body: `${input.reasonLabel} ${dateLabel}, ${timeSlotLabel}.`,
    dedupeKey: input.alertKey,
    metadata: {
      source: "assignment_admin_alert",
      alertKey: input.alertKey,
      reason: input.reason,
      attemptedReplacementCount: attemptedReplacementNames.length,
      originalVolunteerCount: originalVolunteerNames.length,
      assignmentUrl,
      failedInvitationId: input.failedInvitation?.id,
      failedInvitationType: input.failedInvitation?.type,
      failedVolunteerProfileId: input.failedInvitation?.volunteerProfileId,
      automationRunId: input.automationRunId,
      dayOfWeek: assignment.dayOfWeek,
      timeSlot: assignment.timeSlot
    }
  });
  let sentCount = 0;
  let failedCount = 0;

  for (const admin of admins) {
    try {
      const notification = await sendEmailNotification({
        userId: admin.id,
        assignmentId: input.assignmentId,
        type: "ASSIGNMENT_UPDATE",
        subject: email.subject,
        html: email.html,
        metadata: {
          alertKey: input.alertKey,
          reason: input.reason,
          attemptedReplacementCount: attemptedReplacementNames.length,
          originalVolunteerCount: originalVolunteerNames.length,
          assignmentUrl,
          failedInvitationId: input.failedInvitation?.id,
          failedInvitationType: input.failedInvitation?.type,
          failedVolunteerProfileId: input.failedInvitation?.volunteerProfileId,
          automationRunId: input.automationRunId,
          dayOfWeek: DAY_LABELS[assignment.dayOfWeek],
          timeSlot: assignment.timeSlot
        }
      });

      if (notification.status === "SENT") {
        sentCount += 1;
      } else {
        failedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  if (sentCount > 0) {
    await recordAssignmentAuditActivity({
      assignmentId: input.assignmentId,
      event: "ADMIN_ALERTED",
      dedupeKey: input.alertKey,
      metadata: {
        alertKey: input.alertKey,
        reason: input.reason,
        adminCount: admins.length,
        sentCount,
        failedCount,
        attemptedReplacementCount: attemptedReplacementNames.length,
        originalVolunteerCount: originalVolunteerNames.length,
        assignmentUrl,
        failedInvitationId: input.failedInvitation?.id,
        failedInvitationType: input.failedInvitation?.type,
        failedVolunteerProfileId: input.failedInvitation?.volunteerProfileId,
        automationRunId: input.automationRunId
      }
    });
  }

  return {
    sentCount,
    failedCount,
    skipped: false
  };
}

async function alertAdminsForNoReplacementAvailable(
  assignmentId: string,
  automationRunId?: string
) {
  return alertAdminsForAssignment({
    assignmentId,
    alertKey: `no-replacement-available:${assignmentId}`,
    reason: "NO_REPLACEMENT_AVAILABLE",
    reasonLabel:
      "No hay suplentes disponibles o ya se intentaron todos los candidatos elegibles.",
    automationRunId
  });
}

async function reconcileInvitationFromExistingResponse(input: {
  invitation: ExpirableInvitation;
  now: Date;
  tx: Prisma.TransactionClient;
  automationRunId?: string;
}) {
  const response = await input.tx.assignmentResponse.findUnique({
    where: {
      assignmentId_volunteerId: {
        assignmentId: input.invitation.assignmentId,
        volunteerId: input.invitation.volunteerId
      }
    }
  });

  if (!response || response.responseStatus === "PENDING") {
    return false;
  }

  const status =
    response.responseStatus === "CONFIRMED" ? "ACCEPTED" : "DECLINED";
  const updated = await input.tx.assignmentInvitation.updateMany({
    where: {
      id: input.invitation.id,
      status: {
        in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
      }
    },
    data: {
      status,
      respondedAt: response.respondedAt ?? input.now,
      metadata: mergeMetadata(input.invitation.metadata, {
        reconciledByAutomationAt: input.now.toISOString(),
        reconciledFromResponseId: response.id,
        responseStatus: response.responseStatus,
        automationRunId: input.automationRunId
      })
    }
  });

  if (updated.count !== 1) {
    return false;
  }

  await recordAssignmentAuditActivity({
    client: input.tx,
    assignmentId: input.invitation.assignmentId,
    event: status === "ACCEPTED" ? "INVITATION_ACCEPTED" : "INVITATION_DECLINED",
    dedupeKey: `invitation-response:${input.invitation.id}`,
    metadata: mergeRunMetadata({
      invitationId: input.invitation.id,
      invitationType: input.invitation.type,
      volunteerProfileId: input.invitation.volunteerId,
      responseStatus: response.responseStatus,
      responseId: response.id,
      respondedAt: response.respondedAt ?? input.now,
      source: "response_reconciliation"
    }, input.automationRunId)
  });

  return true;
}

async function expireInvitation(input: {
  invitation: ExpirableInvitation;
  now: Date;
  tx: Prisma.TransactionClient;
  automationRunId?: string;
}) {
  const updated = await input.tx.assignmentInvitation.updateMany({
    where: {
      id: input.invitation.id,
      status: {
        in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
      },
      expiresAt: {
        lte: input.now
      }
    },
    data: {
      status: "EXPIRED",
      metadata: mergeMetadata(input.invitation.metadata, {
        expiredAt: input.now.toISOString(),
        expiredBy: "assignment_automation",
        automationRunId: input.automationRunId
      })
    }
  });

  if (updated.count !== 1) {
    return {
      expired: false,
      replacementRequired: false
    };
  }

  await recordAssignmentAuditActivity({
    client: input.tx,
    assignmentId: input.invitation.assignmentId,
    event: "INVITATION_EXPIRED",
    dedupeKey: `invitation-expired:${input.invitation.id}`,
    metadata: mergeRunMetadata({
      invitationId: input.invitation.id,
      invitationType: input.invitation.type,
      volunteerProfileId: input.invitation.volunteerId,
      expiresAt: input.invitation.expiresAt,
      expiredAt: input.now,
      source: "automation_timeout"
    }, input.automationRunId)
  });

  await input.tx.volunteerProfile.update({
    where: {
      id: input.invitation.volunteerId
    },
    data: {
      noResponseCount: {
        increment: 1
      }
    }
  });

  if (isTerminalAssignment(input.invitation.assignment.status)) {
    return {
      expired: true,
      replacementRequired: false
    };
  }

  await input.tx.assignment.update({
    where: {
      id: input.invitation.assignmentId
    },
    data: {
      status: "NEEDS_REPLACEMENT"
    }
  });

  const replacementRequired = await createReplacementRequiredActivityOnce({
    assignmentId: input.invitation.assignmentId,
    tx: input.tx,
    reason: "invitation_expired",
    invitationId: input.invitation.id,
    volunteerProfileId: input.invitation.volunteerId,
    automationRunId: input.automationRunId
  });

  return {
    expired: true,
    replacementRequired
  };
}

export async function sendPendingPrimaryInvitations(input?: {
  automationRunId?: string;
}): Promise<SendPendingPrimaryInvitationsResult> {
  const pendingAssignmentIds = await db.assignmentInvitation.findMany({
    where: {
      type: "PRIMARY",
      status: "PENDING"
    },
    distinct: ["assignmentId"],
    select: {
      assignmentId: true
    },
    take: AUTOMATION_BATCH_SIZE
  });

  let sentCount = 0;
  let failedCount = 0;
  let processedCount = 0;

  for (const pendingAssignment of pendingAssignmentIds) {
    const result = await sendPendingPrimaryInvitationsForAssignment({
      assignmentId: pendingAssignment.assignmentId,
      automationRunId: input?.automationRunId
    });

    sentCount += result.sentCount;
    failedCount += result.failedCount;
    processedCount += result.totalCount;
  }

  return {
    status: "completed",
    processedCount,
    skippedCount: 0,
    sentCount,
    failedCount
  };
}

export async function expireTimedOutInvitations(input?: {
  now?: Date;
  invitationTypes?: AssignmentInvitationType[];
  automationRunId?: string;
}): Promise<ExpireTimedOutInvitationsResult> {
  const now = input?.now ?? new Date();
  const invitations = await db.assignmentInvitation.findMany({
    where: {
      type: input?.invitationTypes?.length
        ? {
            in: input.invitationTypes
          }
        : undefined,
      status: {
        in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
      },
      expiresAt: {
        lte: now
      }
    },
    include: {
      assignment: {
        select: {
          id: true,
          status: true
        }
      }
    },
    orderBy: {
      expiresAt: "asc"
    },
    take: AUTOMATION_BATCH_SIZE
  });

  let expiredCount = 0;
  let reconciledCount = 0;
  let replacementRequiredCount = 0;
  let skippedCount = 0;

  for (const invitation of invitations) {
    const result = await db.$transaction(async (tx) => {
      const reconciled = await reconcileInvitationFromExistingResponse({
        invitation,
        now,
        tx,
        automationRunId: input?.automationRunId
      });

      if (reconciled) {
        return {
          expired: false,
          reconciled: true,
          replacementRequired: false
        };
      }

      const expired = await expireInvitation({
        invitation,
        now,
        tx,
        automationRunId: input?.automationRunId
      });

      return {
        ...expired,
        reconciled: false
      };
    });

    if (result.reconciled) {
      reconciledCount += 1;
      continue;
    }

    if (result.expired) {
      expiredCount += 1;
    } else {
      skippedCount += 1;
    }

    if (result.replacementRequired) {
      replacementRequiredCount += 1;
    }
  }

  return {
    status: "completed",
    processedCount: invitations.length,
    skippedCount,
    expiredCount,
    reconciledCount,
    replacementRequiredCount
  };
}

export async function expireTimedOutPrimaryInvitations(input?: {
  now?: Date;
  automationRunId?: string;
}) {
  return expireTimedOutInvitations({
    now: input?.now,
    automationRunId: input?.automationRunId,
    invitationTypes: ["PRIMARY"]
  });
}

export async function expireTimedOutReplacementInvitations(input?: {
  now?: Date;
  automationRunId?: string;
}) {
  return expireTimedOutInvitations({
    now: input?.now,
    automationRunId: input?.automationRunId,
    invitationTypes: ["REPLACEMENT"]
  });
}

export async function processAssignmentsNeedingReplacement(input?: {
  now?: Date;
  automationRunId?: string;
}): Promise<ProcessAssignmentsNeedingReplacementResult> {
  const today = startOfDay(input?.now ?? new Date());
  const assignments = await db.assignment.findMany({
    where: {
      date: {
        gte: today
      },
      status: {
        notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
      },
      OR: [
        {
          status: "NEEDS_REPLACEMENT"
        },
        {
          responses: {
            some: {
              responseStatus: "DECLINED"
            }
          }
        },
        {
          invitations: {
            some: {
              status: {
                in: ["DECLINED", "EXPIRED"]
              }
            }
          }
        }
      ]
    },
    include: {
      responses: true,
      volunteers: true
    },
    orderBy: [
      {
        date: "asc"
      },
      {
        timeSlot: "asc"
      }
    ],
    take: AUTOMATION_BATCH_SIZE
  });

  let markedCount = 0;
  let alreadyMarkedCount = 0;

  for (const assignment of assignments) {
    const confirmedCount = assignment.responses.filter(
      (response) => response.responseStatus === "CONFIRMED"
    ).length;

    if (
      assignment.volunteers.length > 0 &&
      confirmedCount >= assignment.volunteers.length
    ) {
      continue;
    }

    const result = await db.$transaction(async (tx) => {
      if (assignment.status !== "NEEDS_REPLACEMENT") {
        await tx.assignment.update({
          where: {
            id: assignment.id
          },
          data: {
            status: "NEEDS_REPLACEMENT"
          }
        });
      }

      const logged = await createReplacementRequiredActivityOnce({
        assignmentId: assignment.id,
        tx,
        reason: "assignment_needs_replacement",
        automationRunId: input?.automationRunId
      });

      return {
        statusChanged: assignment.status !== "NEEDS_REPLACEMENT",
        logged
      };
    });

    if (result.statusChanged || result.logged) {
      markedCount += 1;
      const dateLabel = `${DAY_LABELS[assignment.dayOfWeek]}, ${formatDisplayDate(
        assignment.date,
        "d 'de' MMMM 'de' yyyy"
      )}`;
      const timeSlotLabel = TIME_SLOT_DEFINITIONS[assignment.timeSlot].label;

      await createAdminAssignmentAppNotifications({
        assignmentId: assignment.id,
        type: "ADMIN_ATTENTION_REQUIRED",
        priority: "HIGH",
        title: "Turno sin cobertura",
        body: `${dateLabel}, ${timeSlotLabel}, requiere intervención para quedar cubierto.`,
        dedupeKey: `assignment-needs-replacement:${assignment.id}`,
        metadata: {
          source: "process_assignments_needing_replacement",
          reason: "assignment_needs_replacement",
          automationRunId: input?.automationRunId,
          statusChanged: result.statusChanged,
          activityLogged: result.logged,
          dayOfWeek: assignment.dayOfWeek,
          timeSlot: assignment.timeSlot
        }
      });
    } else {
      alreadyMarkedCount += 1;
    }
  }

  return {
    status: "completed",
    processedCount: assignments.length,
    skippedCount: assignments.length - markedCount - alreadyMarkedCount,
    markedCount,
    alreadyMarkedCount
  };
}

export async function inviteNextAvailableReplacementForAssignment(input: {
  assignmentId: string;
  actorUserId?: string;
  automationRunId?: string;
}): Promise<ReplacementInvitationResult> {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: {
      id: input.assignmentId
    },
    include: {
      invitations: {
        where: {
          type: "REPLACEMENT",
          status: {
            in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
          }
        }
      }
    }
  });

  if (assignment.status !== "NEEDS_REPLACEMENT") {
    return {
      assignmentId: input.assignmentId,
      status: "skipped",
      sentCount: 0,
      failedCount: 0
    };
  }

  if (assignment.invitations.length) {
    return {
      assignmentId: input.assignmentId,
      status: "active_invitation",
      sentCount: 0,
      failedCount: 0
    };
  }

  const candidates = await getReplacementCandidatesForAssignment({
    assignmentId: input.assignmentId
  });

  if (!candidates.length) {
    await alertAdminsForNoReplacementAvailable(
      input.assignmentId,
      input.automationRunId
    );
    return {
      assignmentId: input.assignmentId,
      status: "no_candidate",
      sentCount: 0,
      failedCount: 0
    };
  }

  let failedCount = 0;

  for (const [attemptIndex, candidate] of candidates.entries()) {
    const candidateMetadata = {
      volunteerProfileId: candidate.id,
      selectedBy: "replacement_candidate_rules",
      replacementAttemptNumber: attemptIndex + 1,
      availabilitySource: candidate.replacementPriority.availabilitySource,
      availabilityRank: candidate.replacementPriority.availabilityRank,
      confirmationRate: candidate.replacementPriority.confirmationRate,
      futureAssignmentCount: candidate.replacementPriority.futureAssignmentCount,
      areaCompatible: candidate.replacementPriority.areaCompatible,
      automationRunId: input.automationRunId
    };

    await recordAssignmentAuditActivity({
      assignmentId: input.assignmentId,
      actorUserId: input.actorUserId,
      event: "REPLACEMENT_SELECTED",
      dedupeKey: `replacement-selected:${input.assignmentId}:${candidate.id}`,
      metadata: candidateMetadata
    });

    const creation = await createPendingReplacementInvitationForAssignment({
      assignmentId: input.assignmentId,
      volunteerId: candidate.id,
      actorUserId: input.actorUserId,
      metadata: candidateMetadata
    });

    if (creation.createdCount !== 1) {
      continue;
    }

    const delivery = await sendPendingReplacementInvitationsForAssignment({
      assignmentId: input.assignmentId,
      actorUserId: input.actorUserId,
      automationRunId: input.automationRunId
    });

    failedCount += delivery.failedCount;

    if (delivery.sentCount <= 0) {
      continue;
    }

    await db.assignment.updateMany({
      where: {
        id: input.assignmentId,
        status: "NEEDS_REPLACEMENT"
      },
      data: {
        status: "PENDING_CONFIRMATION"
      }
    });

    return {
      assignmentId: input.assignmentId,
      status: "invited",
      candidateId: candidate.id,
      sentCount: delivery.sentCount,
      failedCount
    };
  }

  await alertAdminsForNoReplacementAvailable(
    input.assignmentId,
    input.automationRunId
  );

  return {
    assignmentId: input.assignmentId,
    status: "no_candidate",
    sentCount: 0,
    failedCount
  };
}

export async function inviteNextAvailableReplacement(input?: {
  now?: Date;
  automationRunId?: string;
}): Promise<ReplacementCandidateSelectionResult> {
  const assignments = await db.assignment.findMany({
    where: {
      date: {
        gte: startOfDay(input?.now ?? new Date())
      },
      status: "NEEDS_REPLACEMENT",
      invitations: {
        none: {
          type: "REPLACEMENT",
          status: {
            in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
          }
        }
      }
    },
    select: {
      id: true
    },
    orderBy: [
      {
        date: "asc"
      },
      {
        timeSlot: "asc"
      }
    ],
    take: AUTOMATION_BATCH_SIZE
  });

  let invitedCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let unresolvedCount = 0;
  let activeInvitationCount = 0;

  for (const assignment of assignments) {
    const result = await inviteNextAvailableReplacementForAssignment({
      assignmentId: assignment.id,
      automationRunId: input?.automationRunId
    });

    if (result.status === "invited") {
      invitedCount += 1;
      sentCount += result.sentCount;
      failedCount += result.failedCount;
    }

    if (result.status === "no_candidate") {
      unresolvedCount += 1;
    }

    if (result.status === "active_invitation") {
      activeInvitationCount += 1;
    }
  }

  return {
    status: "completed",
    processedCount: assignments.length,
    skippedCount: 0,
    invitedCount,
    sentCount,
    failedCount,
    unresolvedCount,
    activeInvitationCount
  };
}

function getNormalizedReminderSettings(
  settings: AssignmentAutomationSettings
): AssignmentAutomationSettings {
  return {
    ...settings,
    reminderTimingDays: normalizeReminderTimingDays(settings.reminderTimingDays),
    finalReminderHours:
      Number.isInteger(settings.finalReminderHours) &&
      settings.finalReminderHours > 0
        ? settings.finalReminderHours
        : DEFAULT_FINAL_REMINDER_HOURS,
    primaryResponseTimeoutHours: normalizePositiveHourSetting(
      settings.primaryResponseTimeoutHours,
      DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS
    ),
    primaryReminderOffsetsHours: normalizeReminderOffsetsHours(
      settings.primaryReminderOffsetsHours,
      DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS
    ),
    urgentPrimaryResponseTimeoutHours: normalizePositiveHourSetting(
      settings.urgentPrimaryResponseTimeoutHours,
      DEFAULT_URGENT_PRIMARY_RESPONSE_TIMEOUT_HOURS
    ),
    urgentPrimaryReminderOffsetsHours: normalizeReminderOffsetsHours(
      settings.urgentPrimaryReminderOffsetsHours,
      DEFAULT_URGENT_PRIMARY_REMINDER_OFFSETS_HOURS
    ),
    urgentThresholdHours: normalizePositiveHourSetting(
      settings.urgentThresholdHours,
      DEFAULT_URGENT_THRESHOLD_HOURS
    ),
    replacementResponseTimeoutHours: normalizePositiveHourSetting(
      settings.replacementResponseTimeoutHours,
      DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS
    ),
    replacementReminderOffsetsHours: normalizeReminderOffsetsHours(
      settings.replacementReminderOffsetsHours,
      DEFAULT_REPLACEMENT_REMINDER_OFFSETS_HOURS
    ),
    urgentReplacementResponseTimeoutHours: normalizePositiveHourSetting(
      settings.urgentReplacementResponseTimeoutHours,
      DEFAULT_URGENT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS
    ),
    urgentReplacementReminderOffsetsHours: normalizeReminderOffsetsHours(
      settings.urgentReplacementReminderOffsetsHours,
      DEFAULT_URGENT_REPLACEMENT_REMINDER_OFFSETS_HOURS
    )
  };
}

async function getDueConfirmedReminderRecipients(input: {
  now: Date;
  settings: AssignmentAutomationSettings;
  take?: number;
}): Promise<AssignmentReminderRecipient[]> {
  const assignments = await db.assignment.findMany({
    where: {
      date: {
        gte: startOfDay(input.now)
      },
      status: {
        notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
      },
      responses: {
        some: {
          responseStatus: "CONFIRMED"
        }
      }
    },
    include: {
      responses: true,
      volunteers: {
        include: {
          volunteer: {
            include: {
              user: true
            }
          }
        }
      }
    },
    orderBy: [
      {
        date: "asc"
      },
      {
        timeSlot: "asc"
      }
    ],
    take: input.take ?? AUTOMATION_BATCH_SIZE
  });

  const recipients: AssignmentReminderRecipient[] = [];

  for (const assignment of assignments) {
    const confirmedResponsesByVolunteerId = new Map(
      assignment.responses
        .filter((response) => response.responseStatus === "CONFIRMED")
        .map((response) => [response.volunteerId, response])
    );
    const assignmentStartAt = buildAssignmentStartDate({
      date: assignment.date,
      timeSlot: assignment.timeSlot
    });

    for (const slot of assignment.volunteers) {
      const response = confirmedResponsesByVolunteerId.get(slot.volunteerId);

      if (
        !response ||
        !slot.volunteer.active ||
        !slot.volunteer.user.active
      ) {
        continue;
      }

      const reminder = getDueConfirmedAssignmentReminder({
        assignmentDate: assignment.date,
        timeSlot: assignment.timeSlot,
        now: input.now,
        reminderTimingDays: input.settings.reminderTimingDays,
        finalReminderHours: input.settings.finalReminderHours,
        confirmedAt: response.respondedAt
      });

      if (!reminder) {
        continue;
      }

      recipients.push({
        assignmentId: assignment.id,
        volunteerProfileId: slot.volunteerId,
        volunteerUserId: slot.volunteer.userId,
        volunteerName: slot.volunteer.user.name,
        assignmentDate: assignment.date,
        assignmentStartAt,
        dayOfWeek: assignment.dayOfWeek,
        timeSlot: assignment.timeSlot,
        reminder
      });
    }
  }

  return recipients;
}

async function getDuePendingConfirmationReminderRecipients(input: {
  now: Date;
  settings: AssignmentAutomationSettings;
  invitationTypes?: AssignmentInvitationType[];
  take?: number;
}): Promise<AssignmentReminderRecipient[]> {
  const invitations = await db.assignmentInvitation.findMany({
    where: {
      type: input.invitationTypes?.length
        ? {
            in: input.invitationTypes
          }
        : undefined,
      status: "SENT",
      expiresAt: {
        gt: input.now
      },
      assignment: {
        date: {
          gte: startOfDay(input.now)
        },
        status: {
          notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
        }
      }
    },
    include: {
      assignment: {
        include: {
          responses: true
        }
      },
      volunteer: {
        include: {
          user: true
        }
      }
    },
    orderBy: {
      expiresAt: "asc"
    },
    take: input.take ?? AUTOMATION_BATCH_SIZE
  });

  const recipients: AssignmentReminderRecipient[] = [];

  for (const invitation of invitations) {
    if (!invitation.volunteer.active || !invitation.volunteer.user.active) {
      continue;
    }

    const assignmentStartAt = buildAssignmentStartDate({
      date: invitation.assignment.date,
      timeSlot: invitation.assignment.timeSlot
    });

    if (assignmentStartAt <= input.now) {
      continue;
    }

    const response = invitation.assignment.responses.find(
      (item) => item.volunteerId === invitation.volunteerId
    );

    if (response && response.responseStatus !== "PENDING") {
      continue;
    }

    const reminder =
      invitation.type === "PRIMARY"
        ? getDuePendingConfirmationReminder({
            invitationId: invitation.id,
            sentAt: invitation.sentAt ?? invitation.createdAt,
            expiresAt: invitation.expiresAt,
            now: input.now,
            reminderOffsetsHours: getPrimaryPendingReminderOffsets({
              invitationMetadata: invitation.metadata,
              settings: input.settings
            })
          })
        : getDuePendingConfirmationReminder({
            invitationId: invitation.id,
            sentAt: invitation.sentAt ?? invitation.createdAt,
            expiresAt: invitation.expiresAt,
            now: input.now,
            reminderOffsetsHours: getReplacementPendingReminderOffsets({
              invitationMetadata: invitation.metadata,
              settings: input.settings
            }),
            fallbackReminderOffsetsHours:
              DEFAULT_REPLACEMENT_REMINDER_OFFSETS_HOURS
          });

    if (!reminder) {
      continue;
    }

    recipients.push({
      assignmentId: invitation.assignmentId,
      volunteerProfileId: invitation.volunteerId,
      volunteerUserId: invitation.volunteer.userId,
      volunteerName: invitation.volunteer.user.name,
      assignmentDate: invitation.assignment.date,
      assignmentStartAt,
      dayOfWeek: invitation.assignment.dayOfWeek,
      timeSlot: invitation.assignment.timeSlot,
      reminder,
      responseUrl: buildAssignmentInvitationResponseUrl(invitation.token),
      invitationId: invitation.id,
      invitationType: invitation.type
    });
  }

  return recipients;
}

async function hasSentReminder(input: {
  assignmentId: string;
  userId: string;
  notificationType: NotificationType;
  reminderKey: string;
}) {
  const existingReminder = await db.notificationLog.findFirst({
    where: {
      assignmentId: input.assignmentId,
      userId: input.userId,
      type: input.notificationType,
      channel: "EMAIL",
      status: "SENT",
      metadata: {
        path: ["reminderKey"],
        equals: input.reminderKey
      }
    },
    select: {
      id: true
    }
  });

  return Boolean(existingReminder);
}

async function sendAssignmentReminder(
  recipient: AssignmentReminderRecipient,
  automationRunId?: string
): Promise<"SENT" | "FAILED" | "DUPLICATE"> {
  const alreadySent = await hasSentReminder({
    assignmentId: recipient.assignmentId,
    userId: recipient.volunteerUserId,
    notificationType: recipient.reminder.notificationType,
    reminderKey: recipient.reminder.reminderKey
  });

  if (alreadySent) {
    return "DUPLICATE";
  }

  const dateLabel = `${DAY_LABELS[recipient.dayOfWeek]}, ${formatDisplayDate(
    recipient.assignmentDate,
    "d 'de' MMMM 'de' yyyy"
  )}`;
  const timeSlotLabel = TIME_SLOT_DEFINITIONS[recipient.timeSlot].label;
  const responseUrl =
    recipient.responseUrl ??
    `${getAppBaseUrl()}/volunteer/assignments/${encodeURIComponent(
      recipient.assignmentId
    )}`;
  const email = buildAssignmentReminderEmail({
    kind: recipient.reminder.kind,
    offsetDays: recipient.reminder.offsetDays,
    offsetHours: recipient.reminder.offsetHours,
    volunteerName: recipient.volunteerName,
    dateLabel,
    timeSlotLabel,
    pointName: FIXED_PREACHING_POINT_NAME,
    responseUrl
  });
  const metadata = {
    reminderKey: recipient.reminder.reminderKey,
    reminderKind: recipient.reminder.kind,
    reminderTargetAt: recipient.reminder.targetAt.toISOString(),
    assignmentStartAt: recipient.assignmentStartAt.toISOString(),
    volunteerProfileId: recipient.volunteerProfileId,
    invitationId: recipient.invitationId,
    invitationType: recipient.invitationType,
    dayOfWeek: recipient.dayOfWeek,
    timeSlot: recipient.timeSlot,
    offsetDays: recipient.reminder.offsetDays,
    offsetHours: recipient.reminder.offsetHours,
    automationRunId
  };

  try {
    const notification = await sendEmailNotification({
      userId: recipient.volunteerUserId,
      assignmentId: recipient.assignmentId,
      type: recipient.reminder.notificationType,
      subject: email.subject,
      html: email.html,
      metadata
    });

    if (notification.status !== "SENT") {
      return "FAILED";
    }

    await recordAssignmentAuditActivity({
      assignmentId: recipient.assignmentId,
      event: "REMINDER_SENT",
      dedupeKey: `reminder-sent:${recipient.assignmentId}:${recipient.volunteerUserId}:${recipient.reminder.reminderKey}`,
      metadata: {
        ...metadata,
        notificationLogId: notification.id
      }
    });
    await createAppNotificationOnce({
      userId: recipient.volunteerUserId,
      assignmentId: recipient.assignmentId,
      type:
        recipient.reminder.kind === "PENDING_CONFIRMATION"
          ? "ASSIGNMENT_PENDING"
          : "ASSIGNMENT_CONFIRMED",
      priority:
        recipient.reminder.kind === "PENDING_CONFIRMATION" ? "HIGH" : "NORMAL",
      title:
        recipient.reminder.kind === "PENDING_CONFIRMATION"
          ? "Respuesta pendiente"
          : "Recordatorio de turno",
      body:
        recipient.reminder.kind === "PENDING_CONFIRMATION"
          ? `Confirma o rechaza tu asignación para ${dateLabel}, ${timeSlotLabel}.`
          : `Recuerda tu asignación para ${dateLabel}, ${timeSlotLabel}.`,
      dedupeKey: `assignment-reminder:${recipient.assignmentId}:${recipient.volunteerUserId}:${recipient.reminder.reminderKey}`,
      metadata: {
        ...metadata,
        source: "assignment_reminder",
        notificationLogId: notification.id
      }
    });

    return "SENT";
  } catch {
    return "FAILED";
  }
}

export async function sendDueAssignmentReminders(input?: {
  now?: Date;
  invitationTypes?: AssignmentInvitationType[];
  includePendingConfirmationReminders?: boolean;
  includeConfirmedAssignmentReminders?: boolean;
  automationRunId?: string;
}): Promise<SendDueAssignmentRemindersResult> {
  const now = input?.now ?? new Date();
  const includePendingConfirmationReminders =
    input?.includePendingConfirmationReminders ?? true;
  const includeConfirmedAssignmentReminders =
    input?.includeConfirmedAssignmentReminders ?? true;
  const settings = getNormalizedReminderSettings(
    await getAssignmentAutomationSettings()
  );

  if (!settings.notificationChannels.includes("EMAIL")) {
    return {
      status: "skipped",
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      detail: "Email reminders are disabled in notification settings."
    };
  }

  const [confirmedRecipients, pendingRecipients] = await Promise.all([
    includeConfirmedAssignmentReminders
      ? getDueConfirmedReminderRecipients({
          now,
          settings
        })
      : Promise.resolve([]),
    includePendingConfirmationReminders
      ? getDuePendingConfirmationReminderRecipients({
          now,
          settings,
          invitationTypes: input?.invitationTypes
        })
      : Promise.resolve([])
  ]);
  const recipients = [...pendingRecipients, ...confirmedRecipients];
  let sentCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;

  for (const recipient of recipients) {
    const result = await sendAssignmentReminder(
      recipient,
      input?.automationRunId
    );

    if (result === "SENT") {
      sentCount += 1;
    } else if (result === "FAILED") {
      failedCount += 1;
    } else {
      duplicateCount += 1;
    }
  }

  return {
    status: "completed",
    processedCount: recipients.length,
    skippedCount: duplicateCount,
    sentCount,
    failedCount,
    duplicateCount
  };
}

export async function sendPrimaryResponseReminders(input?: {
  now?: Date;
  automationRunId?: string;
}) {
  return sendDueAssignmentReminders({
    now: input?.now,
    automationRunId: input?.automationRunId,
    invitationTypes: ["PRIMARY"],
    includePendingConfirmationReminders: true,
    includeConfirmedAssignmentReminders: false
  });
}

export async function sendReplacementResponseReminders(input?: {
  now?: Date;
  automationRunId?: string;
}) {
  return sendDueAssignmentReminders({
    now: input?.now,
    automationRunId: input?.automationRunId,
    invitationTypes: ["REPLACEMENT"],
    includePendingConfirmationReminders: true,
    includeConfirmedAssignmentReminders: false
  });
}

function getInvitationFailureError(metadata: Prisma.JsonValue | null) {
  const metadataObject = asMetadataObject(metadata);
  const error = metadataObject.lastEmailError;

  return typeof error === "string" && error.trim().length > 0
    ? error
    : undefined;
}

async function getAssignmentsWithoutReplacementCandidates(now: Date) {
  const assignments = await db.assignment.findMany({
    where: {
      date: {
        gte: startOfDay(now)
      },
      status: "NEEDS_REPLACEMENT",
      invitations: {
        none: {
          type: "REPLACEMENT",
          status: {
            in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
          }
        }
      }
    },
    select: {
      id: true
    },
    orderBy: [
      {
        date: "asc"
      },
      {
        timeSlot: "asc"
      }
    ],
    take: AUTOMATION_BATCH_SIZE
  });
  const unresolvedAssignmentIds: string[] = [];

  for (const assignment of assignments) {
    const candidate = await selectNextReplacementCandidateForAssignment(
      assignment.id
    );

    if (!candidate) {
      unresolvedAssignmentIds.push(assignment.id);
    }
  }

  return unresolvedAssignmentIds;
}

function buildCensusWeekLabel(input: { startDate: Date; endDate: Date }) {
  return `Semana del ${formatDisplayDate(
    input.startDate,
    "d 'de' MMMM"
  )} al ${formatDisplayDate(input.endDate, "d 'de' MMMM 'de' yyyy")}`;
}

function buildAssignmentNotificationLabels(
  assignment: Pick<Assignment, "date" | "dayOfWeek" | "timeSlot">
) {
  return {
    dateLabel: `${DAY_LABELS[assignment.dayOfWeek]}, ${formatDisplayDate(
      assignment.date,
      "d 'de' MMMM 'de' yyyy"
    )}`,
    timeSlotLabel: TIME_SLOT_DEFINITIONS[assignment.timeSlot].label
  };
}

async function getAutomationActorUserId(actorUserId?: string) {
  if (actorUserId) {
    return actorUserId;
  }

  const admin = await db.user.findFirst({
    where: {
      role: "ADMIN",
      active: true
    },
    select: {
      id: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return admin?.id ?? null;
}

export async function openWeeklyReplacementCensus(input?: {
  now?: Date;
  actorUserId?: string;
  automationRunId?: string;
}): Promise<OpenWeeklyReplacementCensusResult> {
  const now = input?.now ?? new Date();
  const actorUserId = await getAutomationActorUserId(input?.actorUserId);

  if (!actorUserId) {
    return {
      status: "skipped",
      processedCount: 0,
      skippedCount: 0,
      openedCount: 0,
      existingOpenCount: 0,
      replacementCount: 0,
      createdResponseCount: 0,
      skippedResponseCount: 0,
      detail: "No active admin user is available to own the weekly census."
    };
  }

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weeks = await db.scheduleWeek.findMany({
    where: {
      endDate: {
        gte: weekStart
      },
      assignments: {
        some: {
          status: {
            notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
          }
        }
      },
      OR: [
        {
          census: {
            is: null
          }
        },
        {
          census: {
            is: {
              status: "DRAFT"
            }
          }
        }
      ]
    },
    include: {
      census: true
    },
    orderBy: {
      startDate: "asc"
    },
    take: AUTOMATION_BATCH_SIZE
  });
  let openedCount = 0;
  let existingOpenCount = 0;
  let replacementCount = 0;
  let createdResponseCount = 0;
  let skippedResponseCount = 0;

  for (const week of weeks) {
    if (week.census?.status === "OPEN") {
      existingOpenCount += 1;
      continue;
    }

    const result = await openReplacementCensusForWeek({
      scheduleWeekId: week.id,
      actorUserId,
      metadata: {
        source: "assignment_automation",
        automationRunId: input?.automationRunId
      }
    });

    openedCount += result.census.status === "OPEN" ? 1 : 0;
    replacementCount += result.replacementCount;
    createdResponseCount += result.createdResponseCount;
    skippedResponseCount += result.skippedResponseCount;
  }

  return {
    status: "completed",
    processedCount: weeks.length,
    skippedCount: existingOpenCount,
    openedCount,
    existingOpenCount,
    replacementCount,
    createdResponseCount,
    skippedResponseCount
  };
}

export async function sendReplacementCensusInvitations(input?: {
  now?: Date;
  automationRunId?: string;
}): Promise<SendReplacementCensusInvitationsResult> {
  const now = input?.now ?? new Date();
  const settings = await getAssignmentAutomationSettings();

  if (!settings.notificationChannels.includes("EMAIL")) {
    return {
      status: "skipped",
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0,
      detail: "Email census invitations are disabled in notification settings."
    };
  }

  const censuses = await db.replacementCensus.findMany({
    where: {
      status: "OPEN",
      closesAt: {
        gt: now
      },
      responses: {
        some: {
          status: "PENDING"
        }
      }
    },
    select: {
      id: true
    },
    orderBy: {
      closesAt: "asc"
    },
    take: AUTOMATION_BATCH_SIZE
  });
  let sentCount = 0;
  let failedCount = 0;
  let processedCount = 0;

  for (const census of censuses) {
    const result = await sendPendingReplacementCensusInvitations({
      censusId: census.id,
      automationRunId: input?.automationRunId
    });

    sentCount += result.sentCount;
    failedCount += result.failedCount;
    processedCount += result.totalCount;
  }

  return {
    status: "completed",
    processedCount,
    skippedCount: 0,
    sentCount,
    failedCount
  };
}

async function hasSentCensusReminder(input: {
  userId: string;
  censusId: string;
  reminderKey: string;
}) {
  const existingReminder = await db.notificationLog.findFirst({
    where: {
      userId: input.userId,
      type: "CENSUS_REMINDER",
      channel: "EMAIL",
      status: "SENT",
      metadata: {
        path: ["reminderKey"],
        equals: input.reminderKey
      }
    },
    select: {
      id: true
    }
  });

  return Boolean(existingReminder);
}

export async function sendReplacementCensusReminders(input?: {
  now?: Date;
  automationRunId?: string;
}): Promise<SendReplacementCensusRemindersResult> {
  const now = input?.now ?? new Date();
  const settings = await getAssignmentAutomationSettings();

  if (!settings.notificationChannels.includes("EMAIL")) {
    return {
      status: "skipped",
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      detail: "Email census reminders are disabled in notification settings."
    };
  }

  const targetAt = addHours(now, CENSUS_REMINDER_HOURS_BEFORE_CLOSE);
  const responses = await db.replacementCensusResponse.findMany({
    where: {
      status: "SENT",
      respondedAt: null,
      expiresAt: {
        gt: now,
        lte: targetAt
      },
      census: {
        status: "OPEN"
      }
    },
    include: {
      census: {
        include: {
          scheduleWeek: true
        }
      },
      volunteer: {
        include: {
          user: true
        }
      }
    },
    orderBy: {
      expiresAt: "asc"
    },
    take: AUTOMATION_BATCH_SIZE
  });
  let sentCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;

  for (const response of responses) {
    const reminderKey = `census-reminder:${response.id}:${CENSUS_REMINDER_HOURS_BEFORE_CLOSE}h`;
    const duplicate = await hasSentCensusReminder({
      userId: response.volunteer.userId,
      censusId: response.censusId,
      reminderKey
    });

    if (duplicate) {
      duplicateCount += 1;
      continue;
    }

    const weekLabel = buildCensusWeekLabel({
      startDate: response.census.scheduleWeek.startDate,
      endDate: response.census.scheduleWeek.endDate
    });
    const email = buildReplacementCensusReminderEmail({
      volunteerName: response.volunteer.user.name,
      weekLabel,
      closesAtLabel: formatDisplayDate(
        response.expiresAt,
        "d 'de' MMMM 'de' yyyy, HH:mm"
      ),
      responseUrl: buildReplacementCensusResponseUrl(response.token)
    });
    const notification = await sendEmailNotification({
      userId: response.volunteer.userId,
      type: "CENSUS_REMINDER",
      subject: email.subject,
      html: email.html,
      metadata: {
        reminderKey,
        censusId: response.censusId,
        censusResponseId: response.id,
        scheduleWeekId: response.census.scheduleWeekId,
        closesAt: response.expiresAt.toISOString(),
        automationRunId: input?.automationRunId
      }
    });

    if (notification.status === "SENT") {
      sentCount += 1;
    } else {
      failedCount += 1;
    }
  }

  return {
    status: "completed",
    processedCount: responses.length,
    skippedCount: duplicateCount,
    sentCount,
    failedCount,
    duplicateCount
  };
}

export async function closeExpiredReplacementCensus(input?: {
  now?: Date;
  automationRunId?: string;
}): Promise<CloseExpiredReplacementCensusResult> {
  const now = input?.now ?? new Date();
  const censuses = await db.replacementCensus.findMany({
    where: {
      status: "OPEN",
      closesAt: {
        lte: now
      }
    },
    select: {
      id: true,
      metadata: true
    },
    orderBy: {
      closesAt: "asc"
    },
    take: AUTOMATION_BATCH_SIZE
  });
  let closedCount = 0;
  let expiredResponseCount = 0;
  let readNotificationCount = 0;

  for (const census of censuses) {
    const result = await db.$transaction(async (tx) => {
      const updatedCensus = await tx.replacementCensus.updateMany({
        where: {
          id: census.id,
          status: "OPEN"
        },
        data: {
          status: "CLOSED",
          metadata: mergeMetadata(census.metadata, {
            closedAt: now.toISOString(),
            closedBy: "assignment_automation",
            automationRunId: input?.automationRunId
          })
        }
      });
      const expiredResponses = await tx.replacementCensusResponse.updateMany({
        where: {
          censusId: census.id,
          status: {
            in: ["PENDING", "SENT"]
          }
        },
        data: {
          status: "EXPIRED"
        }
      });
      const readNotifications = await tx.appNotification.updateMany({
        where: {
          censusId: census.id,
          type: "CENSUS_PENDING",
          readAt: null
        },
        data: {
          readAt: now
        }
      });

      return {
        closedCount: updatedCensus.count,
        expiredResponseCount: expiredResponses.count,
        readNotificationCount: readNotifications.count
      };
    });

    closedCount += result.closedCount;
    expiredResponseCount += result.expiredResponseCount;
    readNotificationCount += result.readNotificationCount;
  }

  return {
    status: "completed",
    processedCount: censuses.length,
    skippedCount: censuses.length - closedCount,
    closedCount,
    expiredResponseCount,
    readNotificationCount
  };
}

export async function createDueAppNotifications(input?: {
  now?: Date;
  automationRunId?: string;
}): Promise<CreateDueAppNotificationsResult> {
  const now = input?.now ?? new Date();
  const today = startOfDay(now);
  const [censusResponses, pendingInvitations, confirmedResponses] =
    await Promise.all([
      db.replacementCensusResponse.findMany({
        where: {
          status: {
            in: ["PENDING", "SENT"]
          },
          expiresAt: {
            gt: now
          },
          census: {
            status: "OPEN"
          },
          volunteer: {
            active: true,
            user: {
              active: true
            }
          }
        },
        include: {
          census: {
            include: {
              scheduleWeek: true
            }
          },
          volunteer: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          expiresAt: "asc"
        },
        take: AUTOMATION_BATCH_SIZE
      }),
      db.assignmentInvitation.findMany({
        where: {
          status: "SENT",
          expiresAt: {
            gt: now
          },
          assignment: {
            date: {
              gte: today
            },
            status: {
              notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
            }
          },
          volunteer: {
            active: true,
            user: {
              active: true
            }
          }
        },
        include: {
          assignment: true,
          volunteer: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          expiresAt: "asc"
        },
        take: AUTOMATION_BATCH_SIZE
      }),
      db.assignmentResponse.findMany({
        where: {
          responseStatus: "CONFIRMED",
          assignment: {
            date: {
              gte: today
            },
            status: {
              notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
            }
          },
          volunteer: {
            active: true,
            user: {
              active: true
            }
          }
        },
        include: {
          assignment: true,
          volunteer: {
            include: {
              user: true
            }
          }
        },
        orderBy: [
          {
            assignment: {
              date: "asc"
            }
          },
          {
            id: "asc"
          }
        ],
        take: AUTOMATION_BATCH_SIZE
      })
    ]);
  let createdCount = 0;
  let duplicateCount = 0;

  for (const response of censusResponses) {
    const weekLabel = buildCensusWeekLabel({
      startDate: response.census.scheduleWeek.startDate,
      endDate: response.census.scheduleWeek.endDate
    });
    const notification = await createAppNotificationOnce({
      userId: response.volunteer.userId,
      censusId: response.censusId,
      type: "CENSUS_PENDING",
      priority: "NORMAL",
      title: "Censo semanal pendiente",
      body: `Indica tu disponibilidad como suplente para ${weekLabel}.`,
      metadata: {
        source: "create_due_app_notifications",
        censusResponseId: response.id,
        scheduleWeekId: response.census.scheduleWeekId,
        weekLabel,
        closesAt: response.expiresAt.toISOString(),
        automationRunId: input?.automationRunId
      }
    });

    if (notification) {
      createdCount += 1;
    } else {
      duplicateCount += 1;
    }
  }

  for (const invitation of pendingInvitations) {
    const { dateLabel, timeSlotLabel } = buildAssignmentNotificationLabels(
      invitation.assignment
    );
    const isReplacement = invitation.type === "REPLACEMENT";
    const notification = await createAppNotificationOnce({
      userId: invitation.volunteer.userId,
      assignmentId: invitation.assignmentId,
      type: "ASSIGNMENT_PENDING",
      priority: isReplacement ? "HIGH" : "NORMAL",
      title: isReplacement
        ? "Invitación de suplente"
        : "Asignación pendiente de respuesta",
      body: isReplacement
        ? `Puedes cubrir como suplente el ${dateLabel}, ${timeSlotLabel}.`
        : `Confirma tu asignación para ${dateLabel}, ${timeSlotLabel}.`,
      dedupeKey: `assignment-pending:${invitation.id}`,
      metadata: {
        source: "create_due_app_notifications",
        invitationId: invitation.id,
        invitationType: invitation.type,
        volunteerProfileId: invitation.volunteerId,
        expiresAt: invitation.expiresAt.toISOString(),
        date: invitation.assignment.date.toISOString(),
        dayOfWeek: invitation.assignment.dayOfWeek,
        timeSlot: invitation.assignment.timeSlot,
        automationRunId: input?.automationRunId
      }
    });

    if (notification) {
      createdCount += 1;
    } else {
      duplicateCount += 1;
    }
  }

  for (const response of confirmedResponses) {
    const { dateLabel, timeSlotLabel } = buildAssignmentNotificationLabels(
      response.assignment
    );
    const notification = await createAppNotificationOnce({
      userId: response.volunteer.userId,
      assignmentId: response.assignmentId,
      type: "ASSIGNMENT_CONFIRMED",
      priority: "NORMAL",
      title: "Asignación confirmada",
      body: `Tu asignación para ${dateLabel}, ${timeSlotLabel}, está confirmada.`,
      dedupeKey: `assignment-confirmed:${response.assignmentId}:${response.volunteerId}`,
      metadata: {
        source: "create_due_app_notifications",
        responseId: response.id,
        volunteerProfileId: response.volunteerId,
        date: response.assignment.date.toISOString(),
        dayOfWeek: response.assignment.dayOfWeek,
        timeSlot: response.assignment.timeSlot,
        automationRunId: input?.automationRunId
      }
    });

    if (notification) {
      createdCount += 1;
    } else {
      duplicateCount += 1;
    }
  }

  return {
    status: "completed",
    processedCount:
      censusResponses.length + pendingInvitations.length + confirmedResponses.length,
    skippedCount: duplicateCount,
    createdCount,
    duplicateCount
  };
}

async function notifyAdminsForLowResponseCensuses(
  now: Date,
  automationRunId?: string
) {
  const censuses = await db.replacementCensus.findMany({
    where: {
      status: "OPEN",
      closesAt: {
        lte: addHours(now, 24)
      }
    },
    include: {
      scheduleWeek: true,
      responses: {
        select: {
          status: true
        }
      }
    },
    orderBy: {
      closesAt: "asc"
    },
    take: AUTOMATION_BATCH_SIZE
  });
  let processedCount = 0;
  let alertedCount = 0;
  let duplicateCount = 0;

  for (const census of censuses) {
    const totalResponses = census.responses.length;

    if (!totalResponses) {
      continue;
    }

    const answeredCount = census.responses.filter((response) =>
      ["SUBMITTED", "DECLINED"].includes(response.status)
    ).length;
    const responseRate = answeredCount / totalResponses;

    if (responseRate >= 0.5) {
      continue;
    }

    processedCount += 1;

    const weekLabel = buildCensusWeekLabel({
      startDate: census.scheduleWeek.startDate,
      endDate: census.scheduleWeek.endDate
    });
    const notifications = await createAdminAppNotifications({
      censusId: census.id,
      type: "ADMIN_ATTENTION_REQUIRED",
      priority: "HIGH",
      title: "Censo con baja respuesta",
      body: `${weekLabel}: ${answeredCount} de ${totalResponses} suplentes han respondido.`,
      dedupeKey: `low-response-census:${census.id}`,
      metadata: {
        source: "low_response_replacement_census",
        censusId: census.id,
        scheduleWeekId: census.scheduleWeekId,
        responseRate,
        answeredCount,
        totalResponses,
        closesAt: census.closesAt.toISOString(),
        automationRunId
      }
    });

    if (notifications.length) {
      alertedCount += 1;
    } else {
      duplicateCount += 1;
    }
  }

  return {
    processedCount,
    alertedCount,
    duplicateCount
  };
}

export async function notifyAdminsForUnresolvedAssignments(input?: {
  now?: Date;
  automationRunId?: string;
}): Promise<NotifyAdminsForUnresolvedAssignmentsResult> {
  const now = input?.now ?? new Date();
  const failedInvitations = await db.assignmentInvitation.findMany({
    where: {
      status: "FAILED",
      assignment: {
        date: {
          gte: startOfDay(now)
        },
        status: {
          notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
        }
      }
    },
    include: {
      volunteer: {
        include: {
          user: true
        }
      }
    },
    orderBy: {
      updatedAt: "asc"
    },
    take: AUTOMATION_BATCH_SIZE
  });
  const unresolvedAssignmentIds =
    await getAssignmentsWithoutReplacementCandidates(now);
  const lowResponseCensuses = await notifyAdminsForLowResponseCensuses(
    now,
    input?.automationRunId
  );
  let sentCount = 0;
  let failedCount = 0;
  let duplicateCount = lowResponseCensuses.duplicateCount;
  let alertedCount = lowResponseCensuses.alertedCount;

  for (const invitation of failedInvitations) {
    const result = await alertAdminsForAssignment({
      assignmentId: invitation.assignmentId,
      alertKey: `invitation-email-failed:${invitation.id}`,
      reason: "INVITATION_EMAIL_FAILED",
      reasonLabel: `Falló el envío de email a ${
        invitation.type === "REPLACEMENT" ? "un suplente" : "un titular"
      }.`,
      failedInvitation: {
        id: invitation.id,
        type: invitation.type,
        volunteerProfileId: invitation.volunteerId,
        volunteerName: invitation.volunteer.user.name,
        errorMessage: getInvitationFailureError(invitation.metadata)
      },
      automationRunId: input?.automationRunId
    });

    if (result.skipped) {
      duplicateCount += 1;
      continue;
    }

    if (result.sentCount > 0) {
      alertedCount += 1;
    }

    sentCount += result.sentCount;
    failedCount += result.failedCount;
  }

  for (const assignmentId of unresolvedAssignmentIds) {
    const result = await alertAdminsForNoReplacementAvailable(
      assignmentId,
      input?.automationRunId
    );

    if (result.skipped) {
      duplicateCount += 1;
      continue;
    }

    if (result.sentCount > 0) {
      alertedCount += 1;
    }

    sentCount += result.sentCount;
    failedCount += result.failedCount;
  }

  const processedCount =
    failedInvitations.length +
    unresolvedAssignmentIds.length +
    lowResponseCensuses.processedCount;

  return {
    status: "completed",
    processedCount,
    skippedCount: duplicateCount,
    alertedCount,
    sentCount,
    failedCount,
    duplicateCount
  };
}

export async function processAssignmentAutomationRun(
  input?: AssignmentAutomationRunInput
): Promise<AssignmentAutomationRunResult> {
  const startedAt = new Date();
  const now = input?.now ?? startedAt;
  const automationRunId = input?.automationRunId ?? randomUUID();

  const sendPendingPrimaryInvitationsResult = await runAutomationStep(
    () => sendPendingPrimaryInvitations({ automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0
    }
  );
  const sendPrimaryResponseRemindersResult = await runAutomationStep(
    () => sendPrimaryResponseReminders({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0,
      duplicateCount: 0
    }
  );
  const expireTimedOutPrimaryInvitationsResult = await runAutomationStep(
    () => expireTimedOutPrimaryInvitations({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      expiredCount: 0,
      reconciledCount: 0,
      replacementRequiredCount: 0
    }
  );
  const openWeeklyReplacementCensusResult = await runAutomationStep(
    () =>
      openWeeklyReplacementCensus({
        now,
        actorUserId: input?.actorUserId,
        automationRunId
      }),
    {
      processedCount: 0,
      skippedCount: 0,
      openedCount: 0,
      existingOpenCount: 0,
      replacementCount: 0,
      createdResponseCount: 0,
      skippedResponseCount: 0
    }
  );
  const sendReplacementCensusInvitationsResult = await runAutomationStep(
    () => sendReplacementCensusInvitations({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0
    }
  );
  const sendReplacementCensusRemindersResult = await runAutomationStep(
    () => sendReplacementCensusReminders({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0,
      duplicateCount: 0
    }
  );
  const closeExpiredReplacementCensusResult = await runAutomationStep(
    () => closeExpiredReplacementCensus({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      closedCount: 0,
      expiredResponseCount: 0,
      readNotificationCount: 0
    }
  );
  const processAssignmentsNeedingReplacementResult = await runAutomationStep(
    () => processAssignmentsNeedingReplacement({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      markedCount: 0,
      alreadyMarkedCount: 0
    }
  );
  const inviteNextAvailableReplacementResult = await runAutomationStep(
    () => inviteNextAvailableReplacement({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      invitedCount: 0,
      sentCount: 0,
      failedCount: 0,
      unresolvedCount: 0,
      activeInvitationCount: 0
    }
  );
  const sendReplacementResponseRemindersResult = await runAutomationStep(
    () => sendReplacementResponseReminders({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0,
      duplicateCount: 0
    }
  );
  const expireTimedOutReplacementInvitationsResult = await runAutomationStep(
    () => expireTimedOutReplacementInvitations({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      expiredCount: 0,
      reconciledCount: 0,
      replacementRequiredCount: 0
    }
  );
  const sendDueAssignmentRemindersResult = await runAutomationStep(
    () =>
      sendDueAssignmentReminders({
        now,
        automationRunId,
        includePendingConfirmationReminders: false,
        includeConfirmedAssignmentReminders: true
      }),
    {
      processedCount: 0,
      skippedCount: 0,
      sentCount: 0,
      failedCount: 0,
      duplicateCount: 0
    }
  );
  const createDueAppNotificationsResult = await runAutomationStep(
    () => createDueAppNotifications({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      createdCount: 0,
      duplicateCount: 0
    }
  );
  const notifyAdminsForUnresolvedAssignmentsResult = await runAutomationStep(
    () => notifyAdminsForUnresolvedAssignments({ now, automationRunId }),
    {
      processedCount: 0,
      skippedCount: 0,
      alertedCount: 0,
      sentCount: 0,
      failedCount: 0,
      duplicateCount: 0
    }
  );
  const stepResults: AssignmentAutomationStepResult[] = [
    sendPendingPrimaryInvitationsResult,
    sendPrimaryResponseRemindersResult,
    expireTimedOutPrimaryInvitationsResult,
    openWeeklyReplacementCensusResult,
    sendReplacementCensusInvitationsResult,
    sendReplacementCensusRemindersResult,
    closeExpiredReplacementCensusResult,
    processAssignmentsNeedingReplacementResult,
    inviteNextAvailableReplacementResult,
    sendReplacementResponseRemindersResult,
    expireTimedOutReplacementInvitationsResult,
    sendDueAssignmentRemindersResult,
    createDueAppNotificationsResult,
    notifyAdminsForUnresolvedAssignmentsResult
  ];
  const failedStepCount = stepResults.filter(
    (result) => result.status === "failed"
  ).length;
  const finishedAt = new Date();
  let result: AssignmentAutomationRunResult = {
    automationRunId,
    status: failedStepCount > 0 ? "completed_with_errors" : "completed",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    failedStepCount,
    summarySaved: true,
    sendPendingPrimaryInvitations: sendPendingPrimaryInvitationsResult,
    sendPrimaryResponseReminders: sendPrimaryResponseRemindersResult,
    expireTimedOutPrimaryInvitations: expireTimedOutPrimaryInvitationsResult,
    openWeeklyReplacementCensus: openWeeklyReplacementCensusResult,
    sendReplacementCensusInvitations: sendReplacementCensusInvitationsResult,
    sendReplacementCensusReminders: sendReplacementCensusRemindersResult,
    closeExpiredReplacementCensus: closeExpiredReplacementCensusResult,
    processAssignmentsNeedingReplacement:
      processAssignmentsNeedingReplacementResult,
    inviteNextAvailableReplacement: inviteNextAvailableReplacementResult,
    sendReplacementResponseReminders: sendReplacementResponseRemindersResult,
    expireTimedOutReplacementInvitations:
      expireTimedOutReplacementInvitationsResult,
    sendDueAssignmentReminders: sendDueAssignmentRemindersResult,
    createDueAppNotifications: createDueAppNotificationsResult,
    notifyAdminsForUnresolvedAssignments:
      notifyAdminsForUnresolvedAssignmentsResult
  };

  try {
    await saveAssignmentAutomationRunSummary(result);
  } catch (error) {
    result = {
      ...result,
      status: "completed_with_errors",
      summarySaved: false,
      summaryError: getErrorMessage(error)
    };
  }

  return result;
}
