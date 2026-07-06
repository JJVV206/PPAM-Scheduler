import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    emailWebhookEvent: {
      create: vi.fn()
    },
    notificationLog: {
      findFirst: vi.fn(),
      update: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx)
    ),
    emailWebhookEvent: {
      findUnique: vi.fn()
    }
  };

  return {
    db,
    getResendWebhookSecret: vi.fn(),
    tx
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/lib/env/config", () => ({
  getResendWebhookSecret: mocks.getResendWebhookSecret
}));

import {
  processResendWebhook,
  verifyResendWebhookSignature
} from "@/services/email-webhook.service";

const now = new Date("2026-07-06T18:00:00.000Z");
const timestamp = `${Math.floor(now.getTime() / 1000)}`;
const secret = `whsec_${Buffer.from("test-secret").toString("base64")}`;

function signBody(body: string, eventId = "evt_1") {
  const signature = createHmac("sha256", Buffer.from("test-secret"))
    .update(`${eventId}.${timestamp}.${body}`)
    .digest("base64");

  return new Headers({
    "svix-id": eventId,
    "svix-signature": `v1,${signature}`,
    "svix-timestamp": timestamp
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getResendWebhookSecret.mockReturnValue(secret);
  mocks.db.emailWebhookEvent.findUnique.mockResolvedValue(null);
  mocks.tx.emailWebhookEvent.create.mockResolvedValue({ id: "webhook-event-1" });
  mocks.tx.notificationLog.update.mockResolvedValue({ id: "notification-log-1" });
});

describe("Resend webhook service", () => {
  it("verifies valid Svix signatures", () => {
    const body = JSON.stringify({ type: "email.delivered" });
    const headers = signBody(body);

    expect(
      verifyResendWebhookSignature({
        body,
        now,
        secret,
        svixId: headers.get("svix-id"),
        svixSignature: headers.get("svix-signature"),
        svixTimestamp: headers.get("svix-timestamp")
      })
    ).toBe(true);
  });

  it("updates matching logs to DELIVERED on email.delivered", async () => {
    const body = JSON.stringify({
      type: "email.delivered",
      created_at: "2026-07-06T18:00:00.000Z",
      data: {
        email_id: "email-1"
      }
    });
    mocks.tx.notificationLog.findFirst.mockResolvedValue({
      errorMessage: null,
      id: "notification-log-1",
      metadata: {
        provider: "resend",
        providerMessageId: "email-1"
      },
      status: "SENT"
    });

    const result = await processResendWebhook({
      body,
      headers: signBody(body),
      now
    });

    expect(result).toMatchObject({
      eventId: "evt_1",
      eventType: "email.delivered",
      notificationLogId: "notification-log-1",
      providerMessageId: "email-1",
      status: "processed",
      updatedStatus: "DELIVERED"
    });
    expect(mocks.tx.notificationLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          metadata: {
            path: ["providerMessageId"],
            equals: "email-1"
          }
        }
      })
    );
    expect(mocks.tx.notificationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorMessage: null,
          status: "DELIVERED",
          metadata: expect.objectContaining({
            deliveredAt: "2026-07-06T18:00:00.000Z",
            resendLastEvent: "email.delivered",
            resendLastEventId: "evt_1"
          })
        }),
        where: {
          id: "notification-log-1"
        }
      })
    );
  });

  it("maps bounced, failed, and suppressed events to FAILED", async () => {
    for (const eventType of ["email.bounced", "email.failed", "email.suppressed"]) {
      vi.clearAllMocks();
      mocks.getResendWebhookSecret.mockReturnValue(secret);
      mocks.db.emailWebhookEvent.findUnique.mockResolvedValue(null);
      mocks.tx.notificationLog.findFirst.mockResolvedValue({
        errorMessage: null,
        id: `notification-log-${eventType}`,
        metadata: {
          providerMessageId: "email-1"
        },
        status: "SENT"
      });

      const body = JSON.stringify({
        type: eventType,
        created_at: "2026-07-06T18:00:00.000Z",
        data: {
          email_id: "email-1",
          reason: "Mailbox unavailable"
        }
      });

      const result = await processResendWebhook({
        body,
        headers: signBody(body, `evt_${eventType}`),
        now
      });

      expect(result.updatedStatus).toBe("FAILED");
      expect(mocks.tx.notificationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            errorMessage: "Mailbox unavailable",
            status: "FAILED",
            metadata: expect.objectContaining({
              deliveryFailureReason: "Mailbox unavailable",
              resendLastEvent: eventType
            })
          })
        })
      );
    }
  });

  it("does not process duplicate webhook events twice", async () => {
    const body = JSON.stringify({
      type: "email.delivered",
      data: {
        email_id: "email-1"
      }
    });
    mocks.db.emailWebhookEvent.findUnique
      .mockResolvedValueOnce({ id: "webhook-event-1" })
      .mockResolvedValueOnce({
        eventType: "email.delivered",
        notificationLogId: "notification-log-1",
        providerMessageId: "email-1"
      });

    const result = await processResendWebhook({
      body,
      headers: signBody(body),
      now
    });

    expect(result).toMatchObject({
      eventId: "evt_1",
      eventType: "email.delivered",
      notificationLogId: "notification-log-1",
      providerMessageId: "email-1",
      status: "duplicate"
    });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
