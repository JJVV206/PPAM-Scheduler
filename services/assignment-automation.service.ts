import { startOfDay } from "date-fns";
import { Prisma } from "@prisma/client";
import type { Assignment, AssignmentInvitation } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import {
  ACTIVE_ASSIGNMENT_INVITATION_STATUSES,
  sendPendingPrimaryInvitationsForAssignment
} from "@/services/assignment-invitation.service";

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

export type AssignmentAutomationRunResult = {
  startedAt: string;
  finishedAt: string;
  sendPendingPrimaryInvitations: SendPendingPrimaryInvitationsResult;
  expireTimedOutInvitations: ExpireTimedOutInvitationsResult;
  processAssignmentsNeedingReplacement: ProcessAssignmentsNeedingReplacementResult;
  inviteNextAvailableReplacement: AssignmentAutomationStepResult;
  sendDueAssignmentReminders: AssignmentAutomationStepResult;
  notifyAdminsForUnresolvedAssignments: AssignmentAutomationStepResult;
};

type ExpirableInvitation = AssignmentInvitation & {
  assignment: Pick<Assignment, "id" | "status">;
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

function isTerminalAssignment(status: Assignment["status"]) {
  return TERMINAL_ASSIGNMENT_STATUSES.includes(
    status as (typeof TERMINAL_ASSIGNMENT_STATUSES)[number]
  );
}

function skippedStep(detail: string): AssignmentAutomationStepResult {
  return {
    status: "skipped",
    processedCount: 0,
    skippedCount: 0,
    detail
  };
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

  return updated.count === 1;
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

  await input.tx.assignmentActivity.create({
    data: {
      assignmentId: input.invitation.assignmentId,
      actionType: "INVITATION_EXPIRED",
      metadata: {
        invitationId: input.invitation.id,
        invitationType: input.invitation.type,
        volunteerProfileId: input.invitation.volunteerId,
        expiresAt: input.invitation.expiresAt.toISOString()
      }
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

export async function inviteNextAvailableReplacement(): Promise<AssignmentAutomationStepResult> {
  return skippedStep(
    "Replacement candidate selection is implemented in module 5 and replacement invitations in module 6."
  );
}

export async function sendDueAssignmentReminders(): Promise<AssignmentAutomationStepResult> {
  return skippedStep("Reminder timing and deduplication are implemented in module 7.");
}

export async function notifyAdminsForUnresolvedAssignments(): Promise<AssignmentAutomationStepResult> {
  return skippedStep("Admin escalation emails are implemented in module 9.");
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
