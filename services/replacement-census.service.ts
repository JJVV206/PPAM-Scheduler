import { randomBytes } from "node:crypto";

import { addHours } from "date-fns";
import { Prisma } from "@prisma/client";
import type { ReplacementCensusResponseStatus } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { DEFAULT_CENSUS_RESPONSE_TIMEOUT_HOURS } from "@/lib/constants/app";
import { getAppBaseUrl } from "@/lib/env/config";
import { formatDisplayDate } from "@/lib/utils";
import { sendEmailNotification } from "@/services/notification.service";
import { getAssignmentAutomationSettings } from "@/services/setting.service";
import { buildReplacementCensusInvitationEmail } from "@/services/email-template.service";

const TOKEN_BYTES = 32;
const MAX_TOKEN_GENERATION_ATTEMPTS = 3;

export const ACTIVE_REPLACEMENT_CENSUS_RESPONSE_STATUSES = [
  "PENDING",
  "SENT"
] satisfies ReplacementCensusResponseStatus[];

type ReplacementCensusClient = Prisma.TransactionClient | typeof db;

type PendingReplacementCensusResponse = Prisma.ReplacementCensusResponseGetPayload<{
  include: {
    census: {
      include: {
        scheduleWeek: true;
      };
    };
    volunteer: {
      include: {
        user: true;
      };
    };
  };
}>;

function createCensusToken() {
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
  ) as Prisma.InputJsonObject;
}

function asMetadataObject(value: Prisma.JsonValue | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
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

function buildWeekLabel(input: { startDate: Date; endDate: Date }) {
  return `Semana del ${formatDisplayDate(
    input.startDate,
    "d 'de' MMMM"
  )} al ${formatDisplayDate(input.endDate, "d 'de' MMMM 'de' yyyy")}`;
}

async function createResponseWithUniqueToken(input: {
  client: ReplacementCensusClient;
  censusId: string;
  volunteerId: string;
  expiresAt: Date;
  metadata: Prisma.InputJsonObject;
}) {
  for (let attempt = 1; attempt <= MAX_TOKEN_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      return await input.client.replacementCensusResponse.create({
        data: {
          censusId: input.censusId,
          volunteerId: input.volunteerId,
          token: createCensusToken(),
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

  throw new Error("No fue posible generar un token unico para el censo.");
}

export function buildReplacementCensusResponseUrl(token: string) {
  return `${getAppBaseUrl()}/replacement-census/${encodeURIComponent(token)}`;
}

export async function openReplacementCensusForWeek(input: {
  scheduleWeekId: string;
  actorUserId: string;
  closesAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const settings = input.closesAt ? null : await getAssignmentAutomationSettings();
  const closesAt =
    input.closesAt ??
    addHours(
      new Date(),
      settings?.censusResponseTimeoutHours ??
        DEFAULT_CENSUS_RESPONSE_TIMEOUT_HOURS
    );
  const openedAt = new Date();

  return db.$transaction(async (tx) => {
    const week = await tx.scheduleWeek.findUniqueOrThrow({
      where: {
        id: input.scheduleWeekId
      },
      include: {
        census: true
      }
    });
    const censusMetadata = compactMetadata({
      openedBy: "week_preparation",
      actorUserId: input.actorUserId,
      openedAt: openedAt.toISOString(),
      ...input.metadata
    });
    const census =
      week.census ??
      (await tx.replacementCensus.create({
        data: {
          scheduleWeekId: week.id,
          status: "OPEN",
          closesAt,
          createdById: input.actorUserId,
          metadata: censusMetadata
        }
      }));

    const openedCensus =
      census.status === "OPEN"
        ? census
        : await tx.replacementCensus.update({
            where: {
              id: census.id
            },
            data: {
              status: "OPEN",
              closesAt: census.closesAt > openedAt ? census.closesAt : closesAt,
              metadata: mergeMetadata(census.metadata, censusMetadata)
            }
          });

    const replacements = await tx.volunteerProfile.findMany({
      where: {
        active: true,
        canServeAsReplacement: true,
        user: {
          active: true
        }
      },
      select: {
        id: true
      }
    });
    const existingResponses = await tx.replacementCensusResponse.findMany({
      where: {
        censusId: openedCensus.id
      },
      select: {
        volunteerId: true
      }
    });
    const existingVolunteerIds = new Set(
      existingResponses.map((response) => response.volunteerId)
    );
    let createdResponseCount = 0;

    for (const replacement of replacements) {
      if (existingVolunteerIds.has(replacement.id)) {
        continue;
      }

      await createResponseWithUniqueToken({
        client: tx,
        censusId: openedCensus.id,
        volunteerId: replacement.id,
        expiresAt: openedCensus.closesAt,
        metadata: compactMetadata({
          source: "week_preparation",
          scheduleWeekId: week.id,
          createdAutomatically: true
        })
      });
      createdResponseCount += 1;
    }

    return {
      census: openedCensus,
      replacementCount: replacements.length,
      createdResponseCount,
      skippedResponseCount: existingResponses.length
    };
  });
}

async function markCensusResponseFailed(input: {
  response: PendingReplacementCensusResponse;
  attemptedMetadata: Prisma.JsonValue | null;
  errorMessage: string;
}) {
  await db.replacementCensusResponse.update({
    where: {
      id: input.response.id
    },
    data: {
      status: "FAILED",
      metadata: mergeMetadata(input.attemptedMetadata, {
        lastEmailStatus: "FAILED",
        lastEmailError: input.errorMessage,
        lastEmailAttemptedAt: new Date().toISOString()
      })
    }
  });
}

async function sendReplacementCensusResponseEmail(
  response: PendingReplacementCensusResponse
) {
  const responseUrl = buildReplacementCensusResponseUrl(response.token);
  const weekLabel = buildWeekLabel({
    startDate: response.census.scheduleWeek.startDate,
    endDate: response.census.scheduleWeek.endDate
  });
  const email = buildReplacementCensusInvitationEmail({
    volunteerName: response.volunteer.user.name,
    weekLabel,
    closesAtLabel: formatDisplayDate(
      response.expiresAt,
      "d 'de' MMMM 'de' yyyy, HH:mm"
    ),
    responseUrl
  });
  const attempt = await db.replacementCensusResponse.update({
    where: {
      id: response.id
    },
    data: {
      emailAttempts: {
        increment: 1
      },
      metadata: mergeMetadata(response.metadata, {
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
      userId: response.volunteer.userId,
      type: "CENSUS_REQUEST",
      subject: email.subject,
      html: email.html,
      metadata: {
        censusId: response.censusId,
        censusResponseId: response.id,
        scheduleWeekId: response.census.scheduleWeekId,
        weekStartDate: response.census.scheduleWeek.startDate.toISOString(),
        weekEndDate: response.census.scheduleWeek.endDate.toISOString(),
        closesAt: response.expiresAt.toISOString()
      }
    });

    if (notification.status !== "SENT") {
      const errorMessage =
        notification.errorMessage ?? "No fue posible enviar el censo.";
      await markCensusResponseFailed({
        response,
        attemptedMetadata: attempt.metadata,
        errorMessage
      });
      return {
        responseId: response.id,
        status: "FAILED" as const,
        errorMessage
      };
    }

    const sentAt = notification.sentAt ?? new Date();
    await db.$transaction(async (tx) => {
      await tx.replacementCensusResponse.update({
        where: {
          id: response.id
        },
        data: {
          status: "SENT",
          sentAt,
          metadata: mergeMetadata(attempt.metadata, {
            lastEmailStatus: "SENT",
            lastNotificationLogId: notification.id
          })
        }
      });
      await tx.replacementCensus.update({
        where: {
          id: response.censusId
        },
        data: {
          sentAt
        }
      });
    });

    return {
      responseId: response.id,
      status: "SENT" as const
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "No fue posible enviar el censo.";
    await markCensusResponseFailed({
      response,
      attemptedMetadata: attempt.metadata,
      errorMessage
    });

    return {
      responseId: response.id,
      status: "FAILED" as const,
      errorMessage
    };
  }
}

export async function sendPendingReplacementCensusInvitations(input: {
  censusId: string;
}) {
  const responses = await db.replacementCensusResponse.findMany({
    where: {
      censusId: input.censusId,
      status: "PENDING"
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
      createdAt: "asc"
    }
  });
  const results = [];

  for (const response of responses) {
    results.push(await sendReplacementCensusResponseEmail(response));
  }

  return {
    totalCount: results.length,
    sentCount: results.filter((result) => result.status === "SENT").length,
    failedCount: results.filter((result) => result.status === "FAILED").length,
    results
  };
}

export type OpenReplacementCensusForWeekResult = Awaited<
  ReturnType<typeof openReplacementCensusForWeek>
>;

export type SendPendingReplacementCensusInvitationsResult = Awaited<
  ReturnType<typeof sendPendingReplacementCensusInvitations>
>;
