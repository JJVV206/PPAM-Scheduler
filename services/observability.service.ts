import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { compactJsonMetadata } from "@/lib/utils/safe-metadata";

export type ObservabilityTimelineSource =
  | "assignment_activity"
  | "assignment_invitation"
  | "notification_log"
  | "app_notification"
  | "replacement_census"
  | "replacement_census_response"
  | "automation_audit_log";

export type ObservabilityTimelineEntry = {
  id: string;
  source: ObservabilityTimelineSource;
  eventType: string;
  createdAt: Date;
  status?: string | null;
  assignmentId?: string | null;
  scheduleWeekId?: string | null;
  censusId?: string | null;
  censusResponseId?: string | null;
  invitationId?: string | null;
  notificationLogId?: string | null;
  appNotificationId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function metadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const compacted = compactJsonMetadata(value as Record<string, unknown>);

  return Object.keys(compacted).length ? compacted : null;
}

function sortTimelineEntries(
  entries: ObservabilityTimelineEntry[]
): ObservabilityTimelineEntry[] {
  return entries.sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
  );
}

export async function getAssignmentObservabilityTimeline(
  assignmentId: string
): Promise<ObservabilityTimelineEntry[]> {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: {
      id: assignmentId
    },
    select: {
      id: true,
      scheduleWeekId: true,
      activities: {
        include: {
          actorUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      invitations: true,
      notifications: true,
      appNotifications: true
    }
  });
  const census = await db.replacementCensus.findUnique({
    where: {
      scheduleWeekId: assignment.scheduleWeekId
    },
    include: {
      responses: true,
      appNotifications: true
    }
  });
  const auditLogFilters: Prisma.AutomationAuditLogWhereInput[] = [
    { assignmentId: assignment.id },
    { scheduleWeekId: assignment.scheduleWeekId }
  ];

  if (census) {
    auditLogFilters.push({ censusId: census.id });
  }

  const auditLogs = await db.automationAuditLog.findMany({
    where: {
      OR: auditLogFilters
    },
    orderBy: {
      createdAt: "asc"
    }
  });
  const entries: ObservabilityTimelineEntry[] = [];

  entries.push(
    ...assignment.activities.map((activity) => ({
      id: activity.id,
      source: "assignment_activity" as const,
      eventType: activity.actionType,
      createdAt: activity.createdAt,
      assignmentId: assignment.id,
      metadata: metadata({
        ...(metadata(activity.metadata) ?? {}),
        actorUserId: activity.actorUserId,
        actorName: activity.actorUser?.name
      })
    }))
  );
  entries.push(
    ...assignment.invitations.map((invitation) => ({
      id: invitation.id,
      source: "assignment_invitation" as const,
      eventType: invitation.type,
      createdAt: invitation.createdAt,
      status: invitation.status,
      assignmentId: assignment.id,
      invitationId: invitation.id,
      metadata: metadata({
        volunteerProfileId: invitation.volunteerId,
        emailAttempts: invitation.emailAttempts,
        sentAt: invitation.sentAt,
        respondedAt: invitation.respondedAt,
        expiresAt: invitation.expiresAt
      })
    }))
  );
  entries.push(
    ...assignment.notifications.map((notification) => ({
      id: notification.id,
      source: "notification_log" as const,
      eventType: notification.type,
      createdAt: notification.createdAt,
      status: notification.status,
      assignmentId: assignment.id,
      notificationLogId: notification.id,
      metadata: metadata({
        ...(metadata(notification.metadata) ?? {}),
        userId: notification.userId,
        channel: notification.channel,
        sentAt: notification.sentAt,
        errorMessage: notification.errorMessage
      })
    }))
  );
  entries.push(
    ...assignment.appNotifications.map((notification) => ({
      id: notification.id,
      source: "app_notification" as const,
      eventType: notification.type,
      createdAt: notification.createdAt,
      status: notification.readAt ? "READ" : "UNREAD",
      assignmentId: assignment.id,
      appNotificationId: notification.id,
      metadata: metadata({
        ...(metadata(notification.metadata) ?? {}),
        userId: notification.userId,
        priority: notification.priority,
        readAt: notification.readAt
      })
    }))
  );

  if (census) {
    entries.push({
      id: census.id,
      source: "replacement_census",
      eventType: "CENSUS",
      createdAt: census.createdAt,
      status: census.status,
      scheduleWeekId: assignment.scheduleWeekId,
      censusId: census.id,
      metadata: metadata({
        ...(metadata(census.metadata) ?? {}),
        closesAt: census.closesAt,
        sentAt: census.sentAt,
        createdById: census.createdById
      })
    });
    entries.push(
      ...census.responses.map((response) => ({
        id: response.id,
        source: "replacement_census_response" as const,
        eventType: "CENSUS_RESPONSE",
        createdAt: response.createdAt,
        status: response.status,
        scheduleWeekId: assignment.scheduleWeekId,
        censusId: census.id,
        censusResponseId: response.id,
        metadata: metadata({
          ...(metadata(response.metadata) ?? {}),
          volunteerProfileId: response.volunteerId,
          sentAt: response.sentAt,
          respondedAt: response.respondedAt,
          expiresAt: response.expiresAt,
          emailAttempts: response.emailAttempts
        })
      }))
    );
    entries.push(
      ...census.appNotifications.map((notification) => ({
        id: notification.id,
        source: "app_notification" as const,
        eventType: notification.type,
        createdAt: notification.createdAt,
        status: notification.readAt ? "READ" : "UNREAD",
        scheduleWeekId: assignment.scheduleWeekId,
        censusId: census.id,
        appNotificationId: notification.id,
        metadata: metadata({
          ...(metadata(notification.metadata) ?? {}),
          userId: notification.userId,
          priority: notification.priority,
          readAt: notification.readAt
        })
      }))
    );
  }

  entries.push(
    ...auditLogs.map((log) => ({
      id: log.id,
      source: "automation_audit_log" as const,
      eventType: log.eventType,
      createdAt: log.createdAt,
      status: log.status,
      assignmentId: log.assignmentId,
      scheduleWeekId: log.scheduleWeekId,
      censusId: log.censusId,
      censusResponseId: log.censusResponseId,
      invitationId: log.invitationId,
      notificationLogId: log.notificationLogId,
      appNotificationId: log.appNotificationId,
      metadata: metadata({
        ...(metadata(log.metadata) ?? {}),
        actorUserId: log.actorUserId,
        automationRunId: log.automationRunId,
        eventCategory: log.eventCategory
      })
    }))
  );

  return sortTimelineEntries(entries);
}
