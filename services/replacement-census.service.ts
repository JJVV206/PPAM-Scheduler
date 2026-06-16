import { randomBytes } from "node:crypto";

import { addDays, addHours, startOfWeek } from "date-fns";
import { Prisma } from "@prisma/client";
import type {
  DayOfWeek,
  ReplacementCensusResponseStatus,
  TimeSlot
} from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { DEFAULT_CENSUS_RESPONSE_TIMEOUT_HOURS } from "@/lib/constants/app";
import { getAppBaseUrl } from "@/lib/env/config";
import { formatDisplayDate } from "@/lib/utils";
import {
  compactJsonMetadata,
  mergeJsonMetadata
} from "@/lib/utils/safe-metadata";
import { sendEmailNotification } from "@/services/notification.service";
import { getAssignmentAutomationSettings } from "@/services/setting.service";
import { buildReplacementCensusInvitationEmail } from "@/services/email-template.service";
import { AppError } from "@/services/errors";
import { recordAutomationAuditLog } from "@/services/automation-audit-log.service";

const TOKEN_BYTES = 32;
const MAX_TOKEN_GENERATION_ATTEMPTS = 3;

export const ACTIVE_REPLACEMENT_CENSUS_RESPONSE_STATUSES = [
  "PENDING",
  "SENT"
] as ReplacementCensusResponseStatus[];

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

export type ReplacementCensusAvailabilityInput = {
  date: Date;
  dayOfWeek: DayOfWeek;
  available: boolean;
  timeSlots?: TimeSlot[];
  notes?: string;
};

export type ReplacementCensusResponseContext =
  | {
      state: "NOT_FOUND";
    }
  | {
      state: "READY" | "EXPIRED" | "RESPONDED" | "FAILED";
      token: string;
      responseId: string;
      censusId: string;
      volunteerName: string;
      weekStart: Date;
      weekEnd: Date;
      closesAt: Date;
      respondedAt?: Date | null;
      availability: Array<{
        date: Date;
        dayOfWeek: DayOfWeek;
        timeSlot?: TimeSlot | null;
        available: boolean;
        notes?: string | null;
      }>;
    };

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
  return compactJsonMetadata(metadata);
}

function mergeMetadata(
  current: Prisma.JsonValue | null,
  next: Record<string, unknown>
) {
  return mergeJsonMetadata(current, next);
}

function buildWeekLabel(input: { startDate: Date; endDate: Date }) {
  return `Semana del ${formatDisplayDate(
    input.startDate,
    "d 'de' MMMM"
  )} al ${formatDisplayDate(input.endDate, "d 'de' MMMM 'de' yyyy")}`;
}

function getReplacementCensusResponseAvailability(input: {
  status: ReplacementCensusResponseStatus;
  expiresAt: Date;
  respondedAt?: Date | null;
  now?: Date;
}) {
  if (
    input.respondedAt ||
    input.status === "SUBMITTED" ||
    input.status === "DECLINED"
  ) {
    return "RESPONDED" as const;
  }

  if (input.status === "FAILED") {
    return "FAILED" as const;
  }

  if (input.status === "EXPIRED" || input.expiresAt <= (input.now ?? new Date())) {
    return "EXPIRED" as const;
  }

  return "READY" as const;
}

function buildWeekDays(input: { startDate: Date }) {
  return Array.from({ length: 7 }).map((_, index) => addDays(input.startDate, index));
}

function hasAvailableDay(input: ReplacementCensusAvailabilityInput[]) {
  return input.some((item) => item.available);
}

function toAvailabilityCreateRows(input: {
  censusResponseId: string;
  volunteerId: string;
  scheduleWeekId: string;
  days: ReplacementCensusAvailabilityInput[];
}): Prisma.ReplacementWeeklyAvailabilityCreateManyInput[] {
  const rows: Prisma.ReplacementWeeklyAvailabilityCreateManyInput[] = [];

  for (const day of input.days) {
    const notes = day.notes?.trim() || undefined;

    if (!day.available) {
      rows.push({
        censusResponseId: input.censusResponseId,
        volunteerId: input.volunteerId,
        scheduleWeekId: input.scheduleWeekId,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        timeSlot: null,
        available: false,
        notes
      });
      continue;
    }

    const timeSlots = [...new Set(day.timeSlots ?? [])];
    if (!timeSlots.length) {
      rows.push({
        censusResponseId: input.censusResponseId,
        volunteerId: input.volunteerId,
        scheduleWeekId: input.scheduleWeekId,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        timeSlot: null,
        available: true,
        notes
      });
      continue;
    }

    for (const timeSlot of timeSlots) {
      rows.push({
        censusResponseId: input.censusResponseId,
        volunteerId: input.volunteerId,
        scheduleWeekId: input.scheduleWeekId,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        timeSlot,
        available: true,
        notes
      });
    }
  }

  return rows;
}

async function createCensusPendingAppNotificationOnce(input: {
  client: Prisma.TransactionClient;
  userId: string;
  censusId: string;
  weekLabel: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await input.client.appNotification.findFirst({
    where: {
      userId: input.userId,
      censusId: input.censusId,
      type: "CENSUS_PENDING"
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return null;
  }

  return input.client.appNotification.create({
    data: {
      userId: input.userId,
      censusId: input.censusId,
      type: "CENSUS_PENDING",
      priority: "NORMAL",
      title: "Censo semanal pendiente",
      body: `Indica tu disponibilidad como suplente para ${input.weekLabel}.`,
      metadata: {
        ...(input.metadata ?? {}),
        source: "replacement_census",
        weekLabel: input.weekLabel
      }
    }
  });
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
    const createdNewCensus = !week.census;
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
        id: true,
        userId: true
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
    const weekLabel = buildWeekLabel({
      startDate: week.startDate,
      endDate: week.endDate
    });

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
          createdAutomatically: true,
          ...input.metadata
        })
      });
      await createCensusPendingAppNotificationOnce({
        client: tx,
        userId: replacement.userId,
        censusId: openedCensus.id,
        weekLabel,
        metadata: input.metadata
      });
      createdResponseCount += 1;
    }

    await recordAutomationAuditLog({
      client: tx,
      eventType: "CENSUS_CREATED",
      status: createdNewCensus ? "SUCCESS" : "SKIPPED",
      scheduleWeekId: week.id,
      censusId: openedCensus.id,
      actorUserId: input.actorUserId,
      automationRunId:
        typeof input.metadata?.automationRunId === "string"
          ? input.metadata.automationRunId
          : undefined,
      metadata: {
        source: "replacement_census",
        openedStatus: openedCensus.status,
        replacementCount: replacements.length,
        createdResponseCount,
        skippedResponseCount: existingResponses.length,
        closesAt: openedCensus.closesAt
      }
    });

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
  response: PendingReplacementCensusResponse,
  automationRunId?: string
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
        lastEmailAttemptedAt: new Date().toISOString(),
        automationRunId
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
      text: email.text,
      metadata: {
        censusId: response.censusId,
        censusResponseId: response.id,
        scheduleWeekId: response.census.scheduleWeekId,
        weekStartDate: response.census.scheduleWeek.startDate.toISOString(),
        weekEndDate: response.census.scheduleWeek.endDate.toISOString(),
        closesAt: response.expiresAt.toISOString(),
        automationRunId
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
            lastNotificationLogId: notification.id,
            automationRunId
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
  automationRunId?: string;
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
    results.push(
      await sendReplacementCensusResponseEmail(response, input.automationRunId)
    );
  }
  const sentCount = results.filter((result) => result.status === "SENT").length;
  const failedCount = results.filter(
    (result) => result.status === "FAILED"
  ).length;

  await recordAutomationAuditLog({
    eventType: "CENSUS_SENT",
    status: failedCount > 0 ? "FAILED" : "SUCCESS",
    censusId: input.censusId,
    automationRunId: input.automationRunId,
    metadata: {
      totalCount: results.length,
      sentCount,
      failedCount,
      responseIds: results.map((result) => result.responseId)
    }
  });

  return {
    totalCount: results.length,
    sentCount,
    failedCount,
    results
  };
}

export async function getReplacementCensusResponseContext(
  token: string
): Promise<ReplacementCensusResponseContext> {
  const response = await db.replacementCensusResponse.findUnique({
    where: {
      token
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
      },
      availability: {
        orderBy: [
          {
            date: "asc"
          },
          {
            timeSlot: "asc"
          }
        ]
      }
    }
  });

  if (!response) {
    return {
      state: "NOT_FOUND"
    };
  }

  return {
    state: getReplacementCensusResponseAvailability({
      status: response.status,
      expiresAt: response.expiresAt,
      respondedAt: response.respondedAt
    }),
    token: response.token,
    responseId: response.id,
    censusId: response.censusId,
    volunteerName: response.volunteer.user.name,
    weekStart: response.census.scheduleWeek.startDate,
    weekEnd: response.census.scheduleWeek.endDate,
    closesAt: response.expiresAt,
    respondedAt: response.respondedAt,
    availability: response.availability.map((item) => ({
      date: item.date,
      dayOfWeek: item.dayOfWeek,
      timeSlot: item.timeSlot,
      available: item.available,
      notes: item.notes
    }))
  };
}

function getCensusResponseError(
  state: Exclude<ReplacementCensusResponseContext["state"], "READY">
) {
  switch (state) {
    case "NOT_FOUND":
      return new AppError("No se encontró este censo.", 404);
    case "EXPIRED":
      return new AppError("El tiempo para responder este censo terminó.", 410);
    case "RESPONDED":
      return new AppError("Este censo ya fue respondido.", 409);
    case "FAILED":
      return new AppError(
        "Este censo no está disponible. Solicita al administrador una revisión.",
        409
      );
  }
}

async function saveReplacementCensusAvailability(input: {
  tx: Prisma.TransactionClient;
  response: {
    id: string;
    censusId: string;
    volunteerId: string;
    status: ReplacementCensusResponseStatus;
    expiresAt: Date;
    respondedAt: Date | null;
    metadata: Prisma.JsonValue | null;
    census: {
      scheduleWeekId: string;
    };
  };
  days: ReplacementCensusAvailabilityInput[];
  now: Date;
  source: "token" | "admin_manual";
  actorUserId?: string;
}) {
  const rows = toAvailabilityCreateRows({
    censusResponseId: input.response.id,
    volunteerId: input.response.volunteerId,
    scheduleWeekId: input.response.census.scheduleWeekId,
    days: input.days
  });
  const responseStatus = hasAvailableDay(input.days) ? "SUBMITTED" : "DECLINED";

  await input.tx.replacementWeeklyAvailability.deleteMany({
    where: {
      censusResponseId: input.response.id
    }
  });

  if (rows.length) {
    await input.tx.replacementWeeklyAvailability.createMany({
      data: rows
    });
  }

  await input.tx.replacementCensusResponse.update({
    where: {
      id: input.response.id
    },
    data: {
      status: responseStatus,
      respondedAt: input.now,
      metadata: mergeMetadata(input.response.metadata, {
        responseSource: input.source,
        respondedAt: input.now.toISOString(),
        actorUserId: input.actorUserId,
        availableDayCount: input.days.filter((day) => day.available).length
      })
    }
  });

  await input.tx.appNotification.updateMany({
    where: {
      user: {
        volunteerProfile: {
          id: input.response.volunteerId
        }
      },
      censusId: input.response.censusId,
      type: "CENSUS_PENDING",
      readAt: null
    },
    data: {
      readAt: input.now
    }
  });

  await recordAutomationAuditLog({
    client: input.tx,
    eventType: "CENSUS_RESPONDED",
    status: "SUCCESS",
    scheduleWeekId: input.response.census.scheduleWeekId,
    censusId: input.response.censusId,
    censusResponseId: input.response.id,
    actorUserId: input.actorUserId,
    metadata: {
      source: input.source,
      volunteerProfileId: input.response.volunteerId,
      responseStatus,
      availableDayCount: input.days.filter((day) => day.available).length,
      savedAvailabilityCount: rows.length
    }
  });

  return {
    responseId: input.response.id,
    status: responseStatus,
    savedAvailabilityCount: rows.length
  };
}

export async function submitReplacementCensusResponse(input: {
  token: string;
  days: ReplacementCensusAvailabilityInput[];
}) {
  const now = new Date();
  const response = await db.replacementCensusResponse.findUnique({
    where: {
      token: input.token
    },
    include: {
      census: {
        select: {
          scheduleWeekId: true
        }
      }
    }
  });

  if (!response) {
    throw getCensusResponseError("NOT_FOUND");
  }

  const availability = getReplacementCensusResponseAvailability({
    status: response.status,
    expiresAt: response.expiresAt,
    respondedAt: response.respondedAt,
    now
  });

  if (availability !== "READY") {
    throw getCensusResponseError(availability);
  }

  return db.$transaction(async (tx) =>
    saveReplacementCensusAvailability({
      tx,
      response,
      days: input.days,
      now,
      source: "token"
    })
  );
}

export async function submitReplacementCensusResponseManually(input: {
  responseId: string;
  actorUserId: string;
  days: ReplacementCensusAvailabilityInput[];
}) {
  const now = new Date();
  const response = await db.replacementCensusResponse.findUnique({
    where: {
      id: input.responseId
    },
    include: {
      census: {
        select: {
          scheduleWeekId: true,
          status: true
        }
      }
    }
  });

  if (!response) {
    throw new AppError("No se encontró esta respuesta de censo.", 404);
  }

  if (response.census.status === "CANCELLED") {
    throw new AppError("No se puede actualizar un censo cancelado.", 409);
  }

  return db.$transaction(async (tx) =>
    saveReplacementCensusAvailability({
      tx,
      response,
      days: input.days,
      now,
      source: "admin_manual",
      actorUserId: input.actorUserId
    })
  );
}

export async function getReplacementCensusAdminDashboard(input?: {
  weekStart?: Date;
}) {
  const weekStart = startOfWeek(input?.weekStart ?? new Date(), {
    weekStartsOn: 1
  });
  const week = await db.scheduleWeek.findFirst({
    where: {
      startDate: weekStart
    },
    include: {
      census: {
        include: {
          responses: {
            include: {
              volunteer: {
                include: {
                  user: true
                }
              },
              availability: {
                orderBy: [
                  {
                    date: "asc"
                  },
                  {
                    timeSlot: "asc"
                  }
                ]
              }
            },
            orderBy: {
              volunteer: {
                user: {
                  name: "asc"
                }
              }
            }
          }
        }
      }
    }
  });
  const availableWeeks = await db.scheduleWeek.findMany({
    orderBy: {
      startDate: "desc"
    },
    select: {
      id: true,
      label: true,
      startDate: true
    }
  });

  if (!week?.census) {
    return {
      week,
      census: null,
      availableWeeks,
      stats: {
        totalResponses: 0,
        submittedResponses: 0,
        pendingResponses: 0,
        declinedResponses: 0
      },
      responses: []
    };
  }

  const responses = week.census.responses.map((response) => ({
    id: response.id,
    volunteerId: response.volunteerId,
    volunteerName: response.volunteer.user.name,
    volunteerEmail: response.volunteer.user.email,
    status: response.status,
    sentAt: response.sentAt,
    respondedAt: response.respondedAt,
    expiresAt: response.expiresAt,
    emailAttempts: response.emailAttempts,
    availability: response.availability.map((item) => ({
      id: item.id,
      date: item.date,
      dayOfWeek: item.dayOfWeek,
      timeSlot: item.timeSlot,
      available: item.available,
      notes: item.notes
    }))
  }));

  return {
    week,
    census: {
      id: week.census.id,
      status: week.census.status,
      sentAt: week.census.sentAt,
      closesAt: week.census.closesAt,
      createdAt: week.census.createdAt
    },
    availableWeeks,
    stats: {
      totalResponses: responses.length,
      submittedResponses: responses.filter(
        (response) => response.status === "SUBMITTED"
      ).length,
      pendingResponses: responses.filter((response) =>
        ACTIVE_REPLACEMENT_CENSUS_RESPONSE_STATUSES.includes(response.status)
      ).length,
      declinedResponses: responses.filter(
        (response) => response.status === "DECLINED"
      ).length
    },
    responses
  };
}

export type OpenReplacementCensusForWeekResult = Awaited<
  ReturnType<typeof openReplacementCensusForWeek>
>;

export type SendPendingReplacementCensusInvitationsResult = Awaited<
  ReturnType<typeof sendPendingReplacementCensusInvitations>
>;
