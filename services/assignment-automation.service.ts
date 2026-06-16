import { addHours, startOfDay, subDays, subHours } from "date-fns";
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
  type AdminAssignmentAlertEmailInput,
  type AdminAssignmentAlertReason
} from "@/services/email-template.service";
import {
  getAssignmentAutomationSettings,
  type AssignmentAutomationSettings
} from "@/services/setting.service";
import { getAppBaseUrl } from "@/lib/env/config";
import { recordAssignmentAuditActivity } from "@/services/assignment-audit.service";

export {
  buildAdminAssignmentAlertEmail
} from "@/services/email-template.service";
export { buildAssignmentStartDate } from "@/lib/assignments/time";
export type {
  AdminAssignmentAlertEmailInput,
  AdminAssignmentAlertReason
} from "@/services/email-template.service";

const TERMINAL_ASSIGNMENT_STATUSES = ["CANCELLED", "COMPLETED"] as const;

type AutomationStepStatus = "completed" | "skipped";

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

export type AssignmentAutomationRunResult = {
  startedAt: string;
  finishedAt: string;
  sendPendingPrimaryInvitations: SendPendingPrimaryInvitationsResult;
  expireTimedOutInvitations: ExpireTimedOutInvitationsResult;
  processAssignmentsNeedingReplacement: ProcessAssignmentsNeedingReplacementResult;
  inviteNextAvailableReplacement: ReplacementCandidateSelectionResult;
  sendDueAssignmentReminders: SendDueAssignmentRemindersResult;
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
}): DueAssignmentReminder | null {
  const assignmentStartAt = buildAssignmentStartDate({
    date: input.assignmentDate,
    timeSlot: input.timeSlot
  });

  if (assignmentStartAt <= input.now) {
    return null;
  }

  if (input.finalReminderHours > 0) {
    const targetAt = subHours(assignmentStartAt, input.finalReminderHours);
    if (targetAt <= input.now) {
      return {
        kind: "FINAL_HOURS",
        reminderKey: `confirmed-final-${input.finalReminderHours}h`,
        notificationType: "FINAL_REMINDER",
        targetAt,
        offsetHours: input.finalReminderHours
      };
    }
  }

  const dueDays = normalizeReminderTimingDays(input.reminderTimingDays).find(
    (daysBefore) => subDays(assignmentStartAt, daysBefore) <= input.now
  );

  if (!dueDays) {
    return null;
  }

  return {
    kind: "DAYS_BEFORE",
    reminderKey: `confirmed-${dueDays}d`,
    notificationType: "REMINDER",
    targetAt: subDays(assignmentStartAt, dueDays),
    offsetDays: dueDays
  };
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
        automationModule: "assignment_automation"
      })
    }
  });

  return true;
}

async function createNoReplacementAvailableActivityOnce(input: {
  assignmentId: string;
  tx: Prisma.TransactionClient;
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
      reason: "no_eligible_replacement_candidate"
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
        tx
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
        failedVolunteerProfileId: input.failedInvitation?.volunteerProfileId
      }
    });
  }

  return {
    sentCount,
    failedCount,
    skipped: false
  };
}

async function alertAdminsForNoReplacementAvailable(assignmentId: string) {
  return alertAdminsForAssignment({
    assignmentId,
    alertKey: `no-replacement-available:${assignmentId}`,
    reason: "NO_REPLACEMENT_AVAILABLE",
    reasonLabel:
      "No hay suplentes disponibles o ya se intentaron todos los candidatos elegibles."
  });
}

async function reconcileInvitationFromExistingResponse(input: {
  invitation: ExpirableInvitation;
  now: Date;
  tx: Prisma.TransactionClient;
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
        responseStatus: response.responseStatus
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
    metadata: {
      invitationId: input.invitation.id,
      invitationType: input.invitation.type,
      volunteerProfileId: input.invitation.volunteerId,
      responseStatus: response.responseStatus,
      responseId: response.id,
      respondedAt: response.respondedAt ?? input.now,
      source: "response_reconciliation"
    }
  });

  return true;
}

async function expireInvitation(input: {
  invitation: ExpirableInvitation;
  now: Date;
  tx: Prisma.TransactionClient;
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
        expiredBy: "assignment_automation"
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
    metadata: {
      invitationId: input.invitation.id,
      invitationType: input.invitation.type,
      volunteerProfileId: input.invitation.volunteerId,
      expiresAt: input.invitation.expiresAt,
      expiredAt: input.now,
      source: "automation_timeout"
    }
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
    volunteerProfileId: input.invitation.volunteerId
  });

  return {
    expired: true,
    replacementRequired
  };
}

export async function sendPendingPrimaryInvitations(): Promise<SendPendingPrimaryInvitationsResult> {
  const pendingAssignmentIds = await db.assignmentInvitation.findMany({
    where: {
      type: "PRIMARY",
      status: "PENDING"
    },
    distinct: ["assignmentId"],
    select: {
      assignmentId: true
    }
  });

  let sentCount = 0;
  let failedCount = 0;
  let processedCount = 0;

  for (const pendingAssignment of pendingAssignmentIds) {
    const result = await sendPendingPrimaryInvitationsForAssignment({
      assignmentId: pendingAssignment.assignmentId
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
}): Promise<ExpireTimedOutInvitationsResult> {
  const now = input?.now ?? new Date();
  const invitations = await db.assignmentInvitation.findMany({
    where: {
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
    }
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
        tx
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
        tx
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

export async function processAssignmentsNeedingReplacement(): Promise<ProcessAssignmentsNeedingReplacementResult> {
  const today = startOfDay(new Date());
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
    ]
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
        reason: "assignment_needs_replacement"
      });

      return {
        statusChanged: assignment.status !== "NEEDS_REPLACEMENT",
        logged
      };
    });

    if (result.statusChanged || result.logged) {
      markedCount += 1;
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
    await alertAdminsForNoReplacementAvailable(input.assignmentId);
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
      areaCompatible: candidate.replacementPriority.areaCompatible
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
      actorUserId: input.actorUserId
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

  await alertAdminsForNoReplacementAvailable(input.assignmentId);

  return {
    assignmentId: input.assignmentId,
    status: "no_candidate",
    sentCount: 0,
    failedCount
  };
}

export async function inviteNextAvailableReplacement(): Promise<ReplacementCandidateSelectionResult> {
  const assignments = await db.assignment.findMany({
    where: {
      date: {
        gte: startOfDay(new Date())
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
    ]
  });

  let invitedCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let unresolvedCount = 0;
  let activeInvitationCount = 0;

  for (const assignment of assignments) {
    const result = await inviteNextAvailableReplacementForAssignment({
      assignmentId: assignment.id
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
    ]
  });

  const recipients: AssignmentReminderRecipient[] = [];

  for (const assignment of assignments) {
    const reminder = getDueConfirmedAssignmentReminder({
      assignmentDate: assignment.date,
      timeSlot: assignment.timeSlot,
      now: input.now,
      reminderTimingDays: input.settings.reminderTimingDays,
      finalReminderHours: input.settings.finalReminderHours
    });

    if (!reminder) {
      continue;
    }

    const confirmedVolunteerIds = new Set(
      assignment.responses
        .filter((response) => response.responseStatus === "CONFIRMED")
        .map((response) => response.volunteerId)
    );
    const assignmentStartAt = buildAssignmentStartDate({
      date: assignment.date,
      timeSlot: assignment.timeSlot
    });

    for (const slot of assignment.volunteers) {
      if (
        !confirmedVolunteerIds.has(slot.volunteerId) ||
        !slot.volunteer.active ||
        !slot.volunteer.user.active
      ) {
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
}): Promise<AssignmentReminderRecipient[]> {
  const invitations = await db.assignmentInvitation.findMany({
    where: {
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
    }
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
  recipient: AssignmentReminderRecipient
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
    offsetHours: recipient.reminder.offsetHours
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

    return "SENT";
  } catch {
    return "FAILED";
  }
}

export async function sendDueAssignmentReminders(input?: {
  now?: Date;
}): Promise<SendDueAssignmentRemindersResult> {
  const now = input?.now ?? new Date();
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
    getDueConfirmedReminderRecipients({
      now,
      settings
    }),
    getDuePendingConfirmationReminderRecipients({
      now,
      settings
    })
  ]);
  const recipients = [...pendingRecipients, ...confirmedRecipients];
  let sentCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;

  for (const recipient of recipients) {
    const result = await sendAssignmentReminder(recipient);

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
    ]
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

export async function notifyAdminsForUnresolvedAssignments(input?: {
  now?: Date;
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
    }
  });
  const unresolvedAssignmentIds =
    await getAssignmentsWithoutReplacementCandidates(now);
  let sentCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  let alertedCount = 0;

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
      }
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
    const result = await alertAdminsForNoReplacementAvailable(assignmentId);

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
    failedInvitations.length + unresolvedAssignmentIds.length;

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

export async function processAssignmentAutomationRun(): Promise<AssignmentAutomationRunResult> {
  const startedAt = new Date();
  const pendingPrimaryInvitations = await sendPendingPrimaryInvitations();
  const expiredInvitations = await expireTimedOutInvitations();
  const assignmentsNeedingReplacement =
    await processAssignmentsNeedingReplacement();
  const replacementInvitations = await inviteNextAvailableReplacement();
  const reminders = await sendDueAssignmentReminders();
  const adminNotifications = await notifyAdminsForUnresolvedAssignments();
  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    sendPendingPrimaryInvitations: pendingPrimaryInvitations,
    expireTimedOutInvitations: expiredInvitations,
    processAssignmentsNeedingReplacement: assignmentsNeedingReplacement,
    inviteNextAvailableReplacement: replacementInvitations,
    sendDueAssignmentReminders: reminders,
    notifyAdminsForUnresolvedAssignments: adminNotifications
  };
}
