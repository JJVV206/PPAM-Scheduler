import { Prisma } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { compactJsonMetadata } from "@/lib/utils/safe-metadata";

export const AUTOMATION_AUDIT_EVENTS = [
  "WEEK_CREATED",
  "PRIMARY_VOLUNTEER_EDITED",
  "PRIMARY_INVITATION_CREATED",
  "PRIMARY_EMAIL_SENT",
  "PRIMARY_REMINDER_SENT",
  "PRIMARY_ACCEPTED",
  "PRIMARY_DECLINED",
  "PRIMARY_EXPIRED",
  "CENSUS_CREATED",
  "CENSUS_SENT",
  "CENSUS_RESPONDED",
  "REPLACEMENT_REQUIRED",
  "REPLACEMENT_SELECTED",
  "REPLACEMENT_INVITATION_SENT",
  "REPLACEMENT_REMINDER_SENT",
  "REPLACEMENT_ACCEPTED",
  "REPLACEMENT_DECLINED",
  "REPLACEMENT_EXPIRED",
  "NO_REPLACEMENT_AVAILABLE",
  "ADMIN_ALERTED",
  "ASSIGNMENT_COVERED",
  "MANUAL_OVERRIDE"
] as const;

export type AutomationAuditEvent = (typeof AUTOMATION_AUDIT_EVENTS)[number];
export type AutomationAuditStatus = "SUCCESS" | "FAILED" | "SKIPPED";

type AutomationAuditLogClient = Prisma.TransactionClient | typeof db;
type AutomationAuditLogWriter = {
  automationAuditLog?: {
    create: typeof db.automationAuditLog.create;
  };
};

function getEventCategory(eventType: AutomationAuditEvent) {
  if (eventType.startsWith("CENSUS")) return "census";
  if (eventType.startsWith("PRIMARY")) return "primary_assignment";
  if (eventType.startsWith("REPLACEMENT")) return "replacement_assignment";
  if (eventType.startsWith("WEEK")) return "schedule_week";
  if (eventType.startsWith("ADMIN")) return "admin_attention";

  return "assignment";
}

export async function recordAutomationAuditLog(input: {
  client?: AutomationAuditLogClient;
  eventType: AutomationAuditEvent;
  status?: AutomationAuditStatus;
  assignmentId?: string;
  scheduleWeekId?: string;
  censusId?: string;
  censusResponseId?: string;
  invitationId?: string;
  notificationLogId?: string;
  appNotificationId?: string;
  actorUserId?: string;
  automationRunId?: string;
  metadata?: Record<string, unknown>;
}) {
  const client = input.client ?? db;
  const auditLog = (client as unknown as AutomationAuditLogWriter)
    .automationAuditLog;

  if (!auditLog) {
    return null;
  }

  return auditLog.create({
    data: {
      eventType: input.eventType,
      eventCategory: getEventCategory(input.eventType),
      status: input.status ?? "SUCCESS",
      assignmentId: input.assignmentId,
      scheduleWeekId: input.scheduleWeekId,
      censusId: input.censusId,
      censusResponseId: input.censusResponseId,
      invitationId: input.invitationId,
      notificationLogId: input.notificationLogId,
      appNotificationId: input.appNotificationId,
      actorUserId: input.actorUserId,
      automationRunId: input.automationRunId,
      metadata: input.metadata
        ? compactJsonMetadata({
            auditSchemaVersion: 1,
            ...input.metadata
          })
        : {
            auditSchemaVersion: 1
          }
    }
  });
}
