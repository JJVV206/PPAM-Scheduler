CREATE TABLE "AutomationAuditLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "status" TEXT,
    "assignmentId" TEXT,
    "scheduleWeekId" TEXT,
    "censusId" TEXT,
    "censusResponseId" TEXT,
    "invitationId" TEXT,
    "notificationLogId" TEXT,
    "appNotificationId" TEXT,
    "actorUserId" TEXT,
    "automationRunId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationAuditLog_eventType_createdAt_idx" ON "AutomationAuditLog"("eventType", "createdAt");
CREATE INDEX "AutomationAuditLog_automationRunId_createdAt_idx" ON "AutomationAuditLog"("automationRunId", "createdAt");
CREATE INDEX "AutomationAuditLog_assignmentId_createdAt_idx" ON "AutomationAuditLog"("assignmentId", "createdAt");
CREATE INDEX "AutomationAuditLog_scheduleWeekId_createdAt_idx" ON "AutomationAuditLog"("scheduleWeekId", "createdAt");
CREATE INDEX "AutomationAuditLog_censusId_createdAt_idx" ON "AutomationAuditLog"("censusId", "createdAt");
CREATE INDEX "AutomationAuditLog_censusResponseId_createdAt_idx" ON "AutomationAuditLog"("censusResponseId", "createdAt");
CREATE INDEX "AutomationAuditLog_invitationId_createdAt_idx" ON "AutomationAuditLog"("invitationId", "createdAt");
