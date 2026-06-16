import { Prisma } from "@prisma/client";
import type { AssignmentActivityType } from "@prisma/client";

import { db } from "@/lib/db/prisma";

export const ASSIGNMENT_AUDIT_EVENTS = [
  "INVITATION_CREATED",
  "INVITATION_SENT",
  "INVITATION_FAILED",
  "INVITATION_ACCEPTED",
  "INVITATION_DECLINED",
  "INVITATION_EXPIRED",
  "REPLACEMENT_SELECTED",
  "NO_REPLACEMENT_AVAILABLE",
  "ADMIN_ALERTED",
  "REMINDER_SENT"
] as const;

export type AssignmentAuditEvent = (typeof ASSIGNMENT_AUDIT_EVENTS)[number];

export const ASSIGNMENT_AUDIT_EVENT_ACTIONS = {
  INVITATION_CREATED: "INVITATION_CREATED",
  INVITATION_SENT: "INVITATION_SENT",
  INVITATION_FAILED: "INVITATION_FAILED",
  INVITATION_ACCEPTED: "INVITATION_ACCEPTED",
  INVITATION_DECLINED: "INVITATION_DECLINED",
  INVITATION_EXPIRED: "INVITATION_EXPIRED",
  REPLACEMENT_SELECTED: "REPLACEMENT_SELECTED",
  NO_REPLACEMENT_AVAILABLE: "NO_REPLACEMENT_AVAILABLE",
  ADMIN_ALERTED: "ADMIN_ALERTED",
  REMINDER_SENT: "REMINDER_SENT"
} satisfies Record<AssignmentAuditEvent, AssignmentActivityType>;

type AssignmentAuditClient = Prisma.TransactionClient | typeof db;

function normalizeAuditMetadataValue(
  value: unknown
): Prisma.InputJsonValue | undefined {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }

  if (value === null) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAuditMetadataValue(item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
  }

  if (typeof value === "object") {
    return compactAssignmentAuditMetadata(value as Record<string, unknown>);
  }

  return undefined;
}

export function compactAssignmentAuditMetadata(
  metadata: Record<string, unknown>
) {
  return Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [key, normalizeAuditMetadataValue(value)] as const)
      .filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
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

  return client.assignmentActivity.create({
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
}
