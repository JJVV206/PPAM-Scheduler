import { randomBytes } from "node:crypto";

import { addHours } from "date-fns";
import { Prisma } from "@prisma/client";
import type {
  AssignmentInvitationStatus,
  AssignmentInvitationType,
  NotificationType
} from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { getAppBaseUrl } from "@/lib/env/config";
import {
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS
} from "@/lib/constants/domain";
import {
  DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS
} from "@/lib/constants/app";
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";
import { formatDisplayDate } from "@/lib/utils";
import { sendEmailNotification } from "@/services/notification.service";
import { getAssignmentAutomationSettings } from "@/services/setting.service";
import {
  buildPrimaryAssignmentInvitationEmail,
  buildReplacementAssignmentInvitationEmail
} from "@/services/email-template.service";

export {
  buildPrimaryAssignmentInvitationEmail,
  buildReplacementAssignmentInvitationEmail
} from "@/services/email-template.service";

const TOKEN_BYTES = 32;
const MAX_TOKEN_GENERATION_ATTEMPTS = 3;

export const ACTIVE_ASSIGNMENT_INVITATION_STATUSES = [
  "PENDING",
  "SENT"
] satisfies AssignmentInvitationStatus[];

type AssignmentInvitationClient = Prisma.TransactionClient | typeof db;

type PendingAssignmentInvitation = Prisma.AssignmentInvitationGetPayload<{
  include: {
    assignment: {
      include: {
        preachingPoint: true;
      };
    };
    volunteer: {
      include: {
        user: true;
      };
    };
  };
}>;

type SendInvitationResult = {
  invitationId: string;
  status: "SENT" | "FAILED";
  errorMessage?: string;
};

export type AssignmentInvitationAvailability =
  | "READY"
  | "EXPIRED"
  | "RESPONDED"
  | "FAILED";

export function getAssignmentInvitationAvailability(input: {
  status: AssignmentInvitationStatus;
  expiresAt: Date;
  respondedAt?: Date | null;
  now?: Date;
}): AssignmentInvitationAvailability {
  if (
    input.respondedAt ||
    input.status === "ACCEPTED" ||
    input.status === "DECLINED"
  ) {
    return "RESPONDED";
  }

  if (input.status === "FAILED") {
    return "FAILED";
  }

  if (input.status === "EXPIRED" || input.expiresAt <= (input.now ?? new Date())) {
    return "EXPIRED";
  }

  return "READY";
}

function createInvitationToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function isUniqueTokenConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("token")
  );
}

function compactMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
}

function asMetadataObject(value: Prisma.JsonValue | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function mergeInvitationMetadata(
  current: Prisma.JsonValue | null,
  next: Record<string, unknown>
) {
  return compactMetadata({
    ...asMetadataObject(current),
    ...next
  }) as Prisma.InputJsonObject;
}

export function buildAssignmentInvitationResponseUrl(token: string) {
  return `${getAppBaseUrl()}/confirm-assignment/${encodeURIComponent(token)}`;
}

async function createInvitationWithUniqueToken(input: {
  client: AssignmentInvitationClient;
  assignmentId: string;
  volunteerId: string;
  type: AssignmentInvitationType;
  expiresAt: Date;
  metadata: Prisma.InputJsonObject;
}) {
  for (let attempt = 1; attempt <= MAX_TOKEN_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      return await input.client.assignmentInvitation.create({
        data: {
          assignmentId: input.assignmentId,
          volunteerId: input.volunteerId,
          type: input.type,
          token: createInvitationToken(),
          expiresAt: input.expiresAt,
          metadata: input.metadata
        }
      });
    } catch (error) {
      if (isUniqueTokenConflict(error) && attempt < MAX_TOKEN_GENERATION_ATTEMPTS) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("No fue posible generar un token unico de invitacion.");
}

export async function createPendingPrimaryInvitationsForAssignment(input: {
  tx?: Prisma.TransactionClient;
  assignmentId: string;
  volunteerIds: string[];
  actorUserId?: string;
  source: "assignment_created" | "manual_confirmation_request";
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const client = input.tx ?? db;
  const volunteerIds = [...new Set(input.volunteerIds)];

  if (!volunteerIds.length) {
    return {
      createdCount: 0,
      skippedCount: 0
    };
  }

  const existingActiveInvitations =
    await client.assignmentInvitation.findMany({
      where: {
        assignmentId: input.assignmentId,
        volunteerId: {
          in: volunteerIds
        },
        type: "PRIMARY",
        status: {
          in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
        }
      },
      select: {
        volunteerId: true
      }
    });

  const existingVolunteerIds = new Set(
    existingActiveInvitations.map((invitation) => invitation.volunteerId)
  );
  const settings = input.expiresAt
    ? null
    : await getAssignmentAutomationSettings();
  const expiresAt =
    input.expiresAt ??
    addHours(
      new Date(),
      settings?.primaryResponseTimeoutHours ??
        DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS
    );
  const metadata = compactMetadata({
    source: input.source,
    actorUserId: input.actorUserId,
    createdAutomatically: input.source === "assignment_created",
    ...input.metadata
  }) as Prisma.InputJsonObject;

  let createdCount = 0;

  for (const volunteerId of volunteerIds) {
    if (existingVolunteerIds.has(volunteerId)) {
      continue;
    }

    await createInvitationWithUniqueToken({
      client,
      assignmentId: input.assignmentId,
      volunteerId,
      type: "PRIMARY",
      expiresAt,
      metadata
    });
    createdCount += 1;
  }

  return {
    createdCount,
    skippedCount: existingActiveInvitations.length
  };
}

export async function createPendingReplacementInvitationForAssignment(input: {
  tx?: Prisma.TransactionClient;
  assignmentId: string;
  volunteerId: string;
  actorUserId?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const client = input.tx ?? db;
  const existingActiveInvitation = await client.assignmentInvitation.findFirst({
    where: {
      assignmentId: input.assignmentId,
      type: "REPLACEMENT",
      status: {
        in: ACTIVE_ASSIGNMENT_INVITATION_STATUSES
      }
    },
    select: {
      id: true
    }
  });

  if (existingActiveInvitation) {
    return {
      createdCount: 0,
      skippedCount: 1
    };
  }

  const alreadyAttempted = await client.assignmentInvitation.findFirst({
    where: {
      assignmentId: input.assignmentId,
      volunteerId: input.volunteerId,
      type: "REPLACEMENT"
    },
    select: {
      id: true
    }
  });

  if (alreadyAttempted) {
    return {
      createdCount: 0,
      skippedCount: 1
    };
  }

  const settings = input.expiresAt
    ? null
    : await getAssignmentAutomationSettings();
  const expiresAt =
    input.expiresAt ??
    addHours(
      new Date(),
      settings?.replacementResponseTimeoutHours ??
        DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS
    );

  await createInvitationWithUniqueToken({
    client,
    assignmentId: input.assignmentId,
    volunteerId: input.volunteerId,
    type: "REPLACEMENT",
    expiresAt,
    metadata: compactMetadata({
      source: "replacement_flow",
      actorUserId: input.actorUserId,
      createdAutomatically: true,
      ...input.metadata
    }) as Prisma.InputJsonObject
  });

  return {
    createdCount: 1,
    skippedCount: 0
  };
}

async function markInvitationFailed(input: {
  invitationId: string;
  assignmentId: string;
  volunteerId: string;
  invitationType: string;
  actorUserId?: string;
  metadata: Prisma.JsonValue | null;
  errorMessage: string;
}) {
  await db.$transaction([
    db.assignmentInvitation.update({
      where: { id: input.invitationId },
      data: {
        status: "FAILED",
        metadata: mergeInvitationMetadata(input.metadata, {
          lastEmailStatus: "FAILED",
          lastEmailError: input.errorMessage,
          lastEmailAttemptedAt: new Date().toISOString()
        })
      }
    }),
    db.assignmentActivity.create({
      data: {
        assignmentId: input.assignmentId,
        actorUserId: input.actorUserId,
        actionType: "INVITATION_FAILED",
        metadata: {
          invitationId: input.invitationId,
          volunteerProfileId: input.volunteerId,
          invitationType: input.invitationType,
          errorMessage: input.errorMessage
        }
      }
    })
  ]);
}

function buildInvitationEmail(input: {
  invitation: PendingAssignmentInvitation;
  responseUrl: string;
  dateLabel: string;
  timeSlotLabel: string;
  pointName: string;
}) {
  if (input.invitation.type === "REPLACEMENT") {
    return buildReplacementAssignmentInvitationEmail({
      volunteerName: input.invitation.volunteer.user.name,
      dateLabel: input.dateLabel,
      timeSlotLabel: input.timeSlotLabel,
      pointName: input.pointName,
      responseUrl: input.responseUrl
    });
  }

  return buildPrimaryAssignmentInvitationEmail({
    volunteerName: input.invitation.volunteer.user.name,
    dateLabel: input.dateLabel,
    timeSlotLabel: input.timeSlotLabel,
    pointName: input.pointName,
    responseUrl: input.responseUrl
  });
}

function getInvitationNotificationType(
  invitationType: AssignmentInvitationType
): NotificationType {
  return invitationType === "REPLACEMENT"
    ? "REPLACEMENT_OPPORTUNITY"
    : "CONFIRMATION_REQUEST";
}

async function sendAssignmentInvitationEmail(
  invitation: PendingAssignmentInvitation,
  actorUserId?: string
): Promise<SendInvitationResult> {
  const responseUrl = buildAssignmentInvitationResponseUrl(invitation.token);
  const dateLabel = `${DAY_LABELS[invitation.assignment.dayOfWeek]}, ${formatDisplayDate(
    invitation.assignment.date,
    "d 'de' MMMM 'de' yyyy"
  )}`;
  const timeSlotLabel =
    TIME_SLOT_DEFINITIONS[invitation.assignment.timeSlot].label;
  const pointName = FIXED_PREACHING_POINT_NAME;
  const email = buildInvitationEmail({
    invitation,
    responseUrl,
    dateLabel,
    timeSlotLabel,
    pointName
  });

  const attempt = await db.assignmentInvitation.update({
    where: { id: invitation.id },
    data: {
      emailAttempts: {
        increment: 1
      },
      metadata: mergeInvitationMetadata(invitation.metadata, {
        lastEmailAttemptedAt: new Date().toISOString()
      })
    },
    select: {
      emailAttempts: true,
      metadata: true
    }
  });

  try {
    const notification = await sendEmailNotification({
      userId: invitation.volunteer.userId,
      assignmentId: invitation.assignmentId,
      type: getInvitationNotificationType(invitation.type),
      subject: email.subject,
      html: email.html,
      metadata: {
        invitationId: invitation.id,
        invitationType: invitation.type,
        pointName,
        date: invitation.assignment.date.toISOString(),
        timeSlot: invitation.assignment.timeSlot
      }
    });

    if (notification.status !== "SENT") {
      const errorMessage =
        notification.errorMessage ?? "No fue posible enviar la invitación.";
      await markInvitationFailed({
        invitationId: invitation.id,
        assignmentId: invitation.assignmentId,
        volunteerId: invitation.volunteerId,
        invitationType: invitation.type,
        actorUserId,
        metadata: attempt.metadata,
        errorMessage
      });
      return {
        invitationId: invitation.id,
        status: "FAILED",
        errorMessage
      };
    }

    await db.$transaction([
      db.assignmentInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "SENT",
          sentAt: notification.sentAt ?? new Date(),
          metadata: mergeInvitationMetadata(attempt.metadata, {
            lastEmailStatus: "SENT",
            lastNotificationLogId: notification.id
          })
        }
      }),
      db.assignmentActivity.create({
        data: {
          assignmentId: invitation.assignmentId,
          actorUserId,
          actionType: "INVITATION_SENT",
          metadata: {
            invitationId: invitation.id,
            volunteerProfileId: invitation.volunteerId,
            invitationType: invitation.type,
            notificationLogId: notification.id,
            emailAttempts: attempt.emailAttempts
          }
        }
      })
    ]);

    return {
      invitationId: invitation.id,
      status: "SENT"
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "No fue posible enviar la invitación.";

    await markInvitationFailed({
      invitationId: invitation.id,
      assignmentId: invitation.assignmentId,
      volunteerId: invitation.volunteerId,
      invitationType: invitation.type,
      actorUserId,
      metadata: attempt.metadata,
      errorMessage
    });

    return {
      invitationId: invitation.id,
      status: "FAILED",
      errorMessage
    };
  }
}

export async function sendPendingPrimaryInvitationsForAssignment(input: {
  assignmentId: string;
  actorUserId?: string;
}) {
  const invitations = await db.assignmentInvitation.findMany({
    where: {
      assignmentId: input.assignmentId,
      type: "PRIMARY",
      status: "PENDING"
    },
    include: {
      assignment: {
        include: {
          preachingPoint: true
        }
      },
      volunteer: {
        include: {
          user: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const results = await Promise.all(
    invitations.map((invitation) =>
      sendAssignmentInvitationEmail(invitation, input.actorUserId)
    )
  );

  return {
    totalCount: results.length,
    sentCount: results.filter((result) => result.status === "SENT").length,
    failedCount: results.filter((result) => result.status === "FAILED").length,
    results
  };
}

export async function sendPendingReplacementInvitationsForAssignment(input: {
  assignmentId: string;
  actorUserId?: string;
}) {
  const invitations = await db.assignmentInvitation.findMany({
    where: {
      assignmentId: input.assignmentId,
      type: "REPLACEMENT",
      status: "PENDING"
    },
    include: {
      assignment: {
        include: {
          preachingPoint: true
        }
      },
      volunteer: {
        include: {
          user: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const results = await Promise.all(
    invitations.map((invitation) =>
      sendAssignmentInvitationEmail(invitation, input.actorUserId)
    )
  );

  return {
    totalCount: results.length,
    sentCount: results.filter((result) => result.status === "SENT").length,
    failedCount: results.filter((result) => result.status === "FAILED").length,
    results
  };
}
