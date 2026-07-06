import { createHmac, timingSafeEqual } from "crypto";
import { Prisma, type NotificationStatus } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { getResendWebhookSecret } from "@/lib/env/config";
import {
  compactJsonMetadata,
  mergeJsonMetadata
} from "@/lib/utils/safe-metadata";

const RESEND_PROVIDER = "resend";
const SVIX_SECRET_PREFIX = "whsec_";
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

const FAILURE_EVENT_TYPES = new Set([
  "email.failed",
  "email.bounced",
  "email.suppressed"
]);

type ResendWebhookData = {
  id?: string;
  email_id?: string;
  message_id?: string;
  reason?: string;
  error?: string;
  status?: string;
  bounce?: {
    message?: string;
    type?: string;
  };
};

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: ResendWebhookData;
};

type WebhookHeaders = Pick<Headers, "get">;

export type ResendWebhookProcessResult = {
  eventId?: string;
  eventType?: string;
  notificationLogId?: string;
  providerMessageId?: string;
  status:
    | "duplicate"
    | "invalid_payload"
    | "invalid_signature"
    | "missing_secret"
    | "processed";
  updatedStatus?: NotificationStatus;
};

function getSvixSecretBytes(secret: string) {
  if (secret.startsWith(SVIX_SECRET_PREFIX)) {
    return Buffer.from(secret.slice(SVIX_SECRET_PREFIX.length), "base64");
  }

  return Buffer.from(secret, "utf8");
}

function parseSvixSignatures(signatureHeader: string) {
  return signatureHeader
    .split(/\s+/)
    .map((signaturePart) => signaturePart.trim())
    .filter(Boolean)
    .map((signaturePart) => {
      const [version, signature] = signaturePart.split(",");
      return version === "v1" ? signature : null;
    })
    .filter((signature): signature is string => Boolean(signature));
}

function timingSafeBase64Compare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function verifyResendWebhookSignature(input: {
  body: string;
  now?: Date;
  secret: string;
  svixId?: string | null;
  svixSignature?: string | null;
  svixTimestamp?: string | null;
}) {
  const svixId = input.svixId?.trim();
  const svixSignature = input.svixSignature?.trim();
  const svixTimestamp = input.svixTimestamp?.trim();

  if (!svixId || !svixSignature || !svixTimestamp) {
    return false;
  }

  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${svixId}.${svixTimestamp}.${input.body}`;
  const expectedSignature = createHmac(
    "sha256",
    getSvixSecretBytes(input.secret)
  )
    .update(signedPayload)
    .digest("base64");

  return parseSvixSignatures(svixSignature).some((signature) =>
    timingSafeBase64Compare(signature, expectedSignature)
  );
}

function parsePayload(body: string): ResendWebhookPayload | null {
  try {
    const parsed = JSON.parse(body) as ResendWebhookPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getProviderMessageId(payload: ResendWebhookPayload) {
  return (
    payload.data?.email_id ??
    payload.data?.message_id ??
    payload.data?.id ??
    null
  );
}

function getFailureMessage(payload: ResendWebhookPayload) {
  const message =
    payload.data?.bounce?.message ??
    payload.data?.reason ??
    payload.data?.error ??
    payload.data?.status;

  if (typeof message === "string" && message.trim()) {
    return message.trim().slice(0, 500);
  }

  return `Resend reportó ${payload.type ?? "un evento de entrega fallida"}.`;
}

function getStatusForEvent(
  eventType: string,
  currentStatus?: NotificationStatus
): NotificationStatus | null {
  if (FAILURE_EVENT_TYPES.has(eventType)) {
    return "FAILED";
  }

  if (eventType === "email.delivered" && currentStatus !== "FAILED") {
    return "DELIVERED";
  }

  return null;
}

function isDuplicateWebhookError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function getDuplicateResult(providerEventId: string) {
  const existing = await db.emailWebhookEvent.findUnique({
    where: {
      providerEventId
    },
    select: {
      eventType: true,
      notificationLogId: true,
      providerMessageId: true
    }
  });

  return {
    eventId: providerEventId,
    eventType: existing?.eventType,
    notificationLogId: existing?.notificationLogId ?? undefined,
    providerMessageId: existing?.providerMessageId ?? undefined,
    status: "duplicate" as const
  };
}

export async function processResendWebhook(input: {
  body: string;
  headers: WebhookHeaders;
  now?: Date;
}): Promise<ResendWebhookProcessResult> {
  const secret = getResendWebhookSecret();
  const svixId = input.headers.get("svix-id")?.trim();
  const svixTimestamp = input.headers.get("svix-timestamp");
  const svixSignature = input.headers.get("svix-signature");

  if (!secret) {
    return {
      eventId: svixId,
      status: "missing_secret"
    };
  }

  if (
    !verifyResendWebhookSignature({
      body: input.body,
      now: input.now,
      secret,
      svixId,
      svixSignature,
      svixTimestamp
    })
  ) {
    return {
      eventId: svixId,
      status: "invalid_signature"
    };
  }

  if (!svixId) {
    return {
      status: "invalid_payload"
    };
  }

  const payload = parsePayload(input.body);
  const eventType = payload?.type;
  if (!payload || !eventType) {
    return {
      eventId: svixId,
      status: "invalid_payload"
    };
  }

  const providerMessageId = getProviderMessageId(payload);
  const eventCreatedAt =
    payload.created_at ?? (input.now ?? new Date()).toISOString();
  const failureMessage = FAILURE_EVENT_TYPES.has(eventType)
    ? getFailureMessage(payload)
    : undefined;

  const existing = await db.emailWebhookEvent.findUnique({
    where: {
      providerEventId: svixId
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return getDuplicateResult(svixId);
  }

  try {
    return await db.$transaction(async (tx) => {
      const notificationLog = providerMessageId
        ? await tx.notificationLog.findFirst({
            where: {
              metadata: {
                path: ["providerMessageId"],
                equals: providerMessageId
              }
            },
            orderBy: {
              createdAt: "desc"
            },
            select: {
              errorMessage: true,
              id: true,
              metadata: true,
              status: true
            }
          })
        : null;
      const nextStatus = notificationLog
        ? getStatusForEvent(eventType, notificationLog.status)
        : null;

      await tx.emailWebhookEvent.create({
        data: {
          provider: RESEND_PROVIDER,
          providerEventId: svixId,
          providerMessageId,
          eventType,
          notificationLogId: notificationLog?.id,
          metadata: compactJsonMetadata({
            eventCreatedAt,
            failureMessage,
            provider: RESEND_PROVIDER,
            providerEventId: svixId,
            providerMessageId
          })
        }
      });

      if (notificationLog && nextStatus) {
        await tx.notificationLog.update({
          where: {
            id: notificationLog.id
          },
          data: {
            status: nextStatus,
            errorMessage:
              nextStatus === "FAILED"
                ? failureMessage
                : notificationLog.errorMessage,
            metadata: mergeJsonMetadata(notificationLog.metadata, {
              deliveredAt:
                nextStatus === "DELIVERED" ? eventCreatedAt : undefined,
              deliveryFailureReason:
                nextStatus === "FAILED" ? failureMessage : undefined,
              resendLastEvent: eventType,
              resendLastEventAt: eventCreatedAt,
              resendLastEventId: svixId
            })
          }
        });
      }

      return {
        eventId: svixId,
        eventType,
        notificationLogId: notificationLog?.id,
        providerMessageId: providerMessageId ?? undefined,
        status: "processed" as const,
        updatedStatus: nextStatus ?? undefined
      };
    });
  } catch (error) {
    if (isDuplicateWebhookError(error)) {
      return getDuplicateResult(svixId);
    }

    throw error;
  }
}
