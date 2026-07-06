-- Add provider-confirmed delivery state after Resend accepts a message.
ALTER TYPE "NotificationStatus" ADD VALUE 'DELIVERED' BEFORE 'FAILED';

-- Record processed email provider webhooks so retries remain idempotent.
CREATE TABLE "EmailWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerEventId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "notificationLogId" TEXT,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailWebhookEvent_providerEventId_key" ON "EmailWebhookEvent"("providerEventId");
CREATE INDEX "EmailWebhookEvent_providerMessageId_createdAt_idx" ON "EmailWebhookEvent"("providerMessageId", "createdAt");
CREATE INDEX "EmailWebhookEvent_notificationLogId_createdAt_idx" ON "EmailWebhookEvent"("notificationLogId", "createdAt");
CREATE INDEX "EmailWebhookEvent_eventType_createdAt_idx" ON "EmailWebhookEvent"("eventType", "createdAt");

ALTER TABLE "EmailWebhookEvent"
ADD CONSTRAINT "EmailWebhookEvent_notificationLogId_fkey"
FOREIGN KEY ("notificationLogId")
REFERENCES "NotificationLog"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
