-- CreateIndex
CREATE INDEX "NotificationLog_assignmentId_userId_type_status_idx" ON "NotificationLog"("assignmentId", "userId", "type", "status");

-- UpdateData
UPDATE "AppSetting"
SET "value" = '[5, 1]'::jsonb,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'reminderTimingDays'
  AND "value" = '[8, 3, 1]'::jsonb;
