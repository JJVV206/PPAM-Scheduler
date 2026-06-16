import { Prisma } from "@prisma/client";
import type { AssignmentActivityType } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { compactJsonMetadata } from "@/lib/utils/safe-metadata";
import {
  recordAutomationAuditLog,
  type AutomationAuditEvent
} from "@/services/automation-audit-log.service";

export const ASSIGNMENT_AUDIT_EVENTS = [
  "ASSIGNED",
  "REPLACEMENT_REQUIRED",
  "RESPONSE_RECEIVED",
  "INVITATION_CREATED",
  "INVITATION_SENT",
  "INVITATION_FAILED",
  "INVITATION_ACCEPTED",
  "INVITATION_DECLINED",
  "INVITATION_EXPIRED",
  "REPLACEMENT_ASSIGNED",
  "REPLACEMENT_SELECTED",
  "NO_REPLACEMENT_AVAILABLE",
  "ADMIN_ALERTED",
  "REMINDER_SENT",
  "ASSIGNMENT_COVERED",
  "MANUAL_OVERRIDE",
  "NOTES_UPDATED",
  "CANCELLED"
] as const;

export type AssignmentAuditEvent = (typeof ASSIGNMENT_AUDIT_EVENTS)[number];

export const ASSIGNMENT_AUDIT_EVENT_ACTIONS = {
  ASSIGNED: "ASSIGNED",
  REPLACEMENT_REQUIRED: "REPLACEMENT_REQUIRED",
  RESPONSE_RECEIVED: "RESPONSE_RECEIVED",
  INVITATION_CREATED: "INVITATION_CREATED",
  INVITATION_SENT: "INVITATION_SENT",
  INVITATION_FAILED: "INVITATION_FAILED",
  INVITATION_ACCEPTED: "INVITATION_ACCEPTED",
  INVITATION_DECLINED: "INVITATION_DECLINED",
  INVITATION_EXPIRED: "INVITATION_EXPIRED",
  REPLACEMENT_ASSIGNED: "REPLACEMENT_ASSIGNED",
  REPLACEMENT_SELECTED: "REPLACEMENT_SELECTED",
  NO_REPLACEMENT_AVAILABLE: "NO_REPLACEMENT_AVAILABLE",
  ADMIN_ALERTED: "ADMIN_ALERTED",
  REMINDER_SENT: "REMINDER_SENT",
  ASSIGNMENT_COVERED: "COMPLETED",
  MANUAL_OVERRIDE: "STATUS_OVERRIDDEN",
  NOTES_UPDATED: "NOTES_UPDATED",
  CANCELLED: "CANCELLED"
} satisfies Record<AssignmentAuditEvent, AssignmentActivityType>;

type AssignmentAuditClient = Prisma.TransactionClient | typeof db;

function getStringMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function hasMetadataListValue(
  metadata: Record<string, unknown> | undefined,
  key: string,
  expectedValue: string
) {
  const value = metadata?.[key];
  return Array.isArray(value) && value.includes(expectedValue);
}

function getPlanAuditEvent(input: {
  event: AssignmentAuditEvent;
  metadata?: Record<string, unknown>;
}): AutomationAuditEvent {
  const invitationType = getStringMetadataValue(
    input.metadata,
    "invitationType"
  );

  switch (input.event) {
    case "INVITATION_CREATED":
      return invitationType === "REPLACEMENT"
        ? "REPLACEMENT_SELECTED"
        : "PRIMARY_INVITATION_CREATED";
    case "INVITATION_SENT":
      return invitationType === "REPLACEMENT"
        ? "REPLACEMENT_INVITATION_SENT"
        : "PRIMARY_EMAIL_SENT";
    case "REMINDER_SENT":
      return invitationType === "REPLACEMENT"
        ? "REPLACEMENT_REMINDER_SENT"
        : "PRIMARY_REMINDER_SENT";
    case "INVITATION_ACCEPTED":
      return invitationType === "REPLACEMENT"
        ? "REPLACEMENT_ACCEPTED"
        : "PRIMARY_ACCEPTED";
    case "INVITATION_DECLINED":
      return invitationType === "REPLACEMENT"
        ? "REPLACEMENT_DECLINED"
        : "PRIMARY_DECLINED";
    case "INVITATION_EXPIRED":
      return invitationType === "REPLACEMENT"
        ? "REPLACEMENT_EXPIRED"
        : "PRIMARY_EXPIRED";
    case "REPLACEMENT_SELECTED":
      return "REPLACEMENT_SELECTED";
    case "NO_REPLACEMENT_AVAILABLE":
      return "NO_REPLACEMENT_AVAILABLE";
    case "ADMIN_ALERTED":
      return "ADMIN_ALERTED";
    case "REPLACEMENT_ASSIGNED":
    case "ASSIGNMENT_COVERED":
      return "ASSIGNMENT_COVERED";
    case "MANUAL_OVERRIDE":
      return hasMetadataListValue(input.metadata, "updatedFields", "volunteers")
        ? "PRIMARY_VOLUNTEER_EDITED"
        : "MANUAL_OVERRIDE";
    case "NOTES_UPDATED":
    case "CANCELLED":
      return "MANUAL_OVERRIDE";
    case "RESPONSE_RECEIVED":
      return getStringMetadataValue(input.metadata, "responseStatus") ===
        "DECLINED"
        ? "PRIMARY_DECLINED"
        : "PRIMARY_ACCEPTED";
    case "REPLACEMENT_REQUIRED":
      return "REPLACEMENT_REQUIRED";
    case "ASSIGNED":
      return "MANUAL_OVERRIDE";
  }

  return "MANUAL_OVERRIDE";
}

export function compactAssignmentAuditMetadata(
  metadata: Record<string, unknown>
) {
  return compactJsonMetadata(metadata);
}

export function buildAssignmentAuditMetadata(input: {
  event: AssignmentAuditEvent;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}) {
  return compactAssignmentAuditMetadata({
    auditEvent: input.event,
    auditSchemaVersion: 1,
    automationModule: "assignment_automation",
    dedupeKey: input.dedupeKey,
    ...input.metadata
  });
}

export async function recordAssignmentAuditActivity(input: {
  client?: AssignmentAuditClient;
  assignmentId: string;
  actorUserId?: string;
  event: AssignmentAuditEvent;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}) {
  const client = input.client ?? db;
  const actionType = ASSIGNMENT_AUDIT_EVENT_ACTIONS[input.event];

  if (input.dedupeKey) {
    const existingActivity = await client.assignmentActivity.findFirst({
      where: {
        assignmentId: input.assignmentId,
        actionType,
        metadata: {
          path: ["dedupeKey"],
          equals: input.dedupeKey
        }
      },
      select: {
        id: true
      }
    });

    if (existingActivity) {
      return null;
    }
  }

  const activity = await client.assignmentActivity.create({
    data: {
      assignmentId: input.assignmentId,
      actorUserId: input.actorUserId,
      actionType,
      metadata: buildAssignmentAuditMetadata({
        event: input.event,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata
      })
    }
  });

  await recordAutomationAuditLog({
    client,
    eventType: getPlanAuditEvent({
      event: input.event,
      metadata: input.metadata
    }),
    assignmentId: input.assignmentId,
    invitationId: getStringMetadataValue(input.metadata, "invitationId"),
    notificationLogId: getStringMetadataValue(
      input.metadata,
      "notificationLogId"
    ),
    actorUserId: input.actorUserId,
    automationRunId: getStringMetadataValue(input.metadata, "automationRunId"),
    metadata: {
      sourceAuditActivityId: activity?.id,
      sourceAuditEvent: input.event,
      actionType,
      ...input.metadata
    }
  });

  return activity;
}
