import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    assignment: {
      findUniqueOrThrow: vi.fn()
    },
    replacementCensus: {
      findUnique: vi.fn()
    },
    automationAuditLog: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import { getAssignmentObservabilityTimeline } from "@/services/observability.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assignment observability timeline", () => {
  it("reconstructs a sanitized timeline across audit sources", async () => {
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValue({
      id: "assignment-1",
      scheduleWeekId: "week-1",
      activities: [
        {
          id: "activity-1",
          actionType: "INVITATION_SENT",
          createdAt: new Date("2026-06-16T10:00:00.000Z"),
          actorUserId: "admin-1",
          metadata: {
            token: "secret",
            invitationId: "invitation-1"
          },
          actorUser: {
            id: "admin-1",
            name: "Admin"
          }
        }
      ],
      invitations: [
        {
          id: "invitation-1",
          type: "PRIMARY",
          status: "SENT",
          volunteerId: "volunteer-1",
          emailAttempts: 1,
          sentAt: new Date("2026-06-16T10:00:00.000Z"),
          respondedAt: null,
          expiresAt: new Date("2026-06-18T10:00:00.000Z"),
          createdAt: new Date("2026-06-16T09:58:00.000Z")
        }
      ],
      notifications: [
        {
          id: "notification-1",
          type: "CONFIRMATION_REQUEST",
          status: "SENT",
          channel: "EMAIL",
          userId: "user-1",
          sentAt: new Date("2026-06-16T10:00:00.000Z"),
          errorMessage: null,
          createdAt: new Date("2026-06-16T10:00:00.000Z"),
          metadata: {
            responseUrl: "https://example.org/confirm/secret",
            invitationId: "invitation-1"
          }
        }
      ],
      appNotifications: []
    });
    mocks.db.replacementCensus.findUnique.mockResolvedValue({
      id: "census-1",
      status: "OPEN",
      scheduleWeekId: "week-1",
      closesAt: new Date("2026-06-18T12:00:00.000Z"),
      sentAt: new Date("2026-06-16T12:00:00.000Z"),
      createdById: "admin-1",
      createdAt: new Date("2026-06-16T11:00:00.000Z"),
      metadata: {
        token: "secret",
        source: "week_preparation"
      },
      responses: [
        {
          id: "census-response-1",
          status: "SENT",
          volunteerId: "volunteer-2",
          sentAt: new Date("2026-06-16T12:00:00.000Z"),
          respondedAt: null,
          expiresAt: new Date("2026-06-18T12:00:00.000Z"),
          emailAttempts: 1,
          createdAt: new Date("2026-06-16T11:05:00.000Z"),
          metadata: {
            responseUrl: "https://example.org/replacement-census/secret",
            source: "week_preparation"
          }
        }
      ],
      appNotifications: []
    });
    mocks.db.automationAuditLog.findMany.mockResolvedValue([
      {
        id: "automation-log-1",
        eventType: "CENSUS_SENT",
        eventCategory: "census",
        status: "SUCCESS",
        assignmentId: null,
        scheduleWeekId: "week-1",
        censusId: "census-1",
        censusResponseId: null,
        invitationId: null,
        notificationLogId: null,
        appNotificationId: null,
        actorUserId: "admin-1",
        automationRunId: "run-1",
        createdAt: new Date("2026-06-16T12:01:00.000Z"),
        metadata: {
          secret: "secret",
          sentCount: 1
        }
      }
    ]);

    const timeline = await getAssignmentObservabilityTimeline("assignment-1");

    expect(timeline.map((entry) => entry.source)).toEqual([
      "assignment_invitation",
      "assignment_activity",
      "notification_log",
      "replacement_census",
      "replacement_census_response",
      "automation_audit_log"
    ]);
    expect(JSON.stringify(timeline)).not.toContain("secret");
    expect(timeline.at(-1)).toMatchObject({
      source: "automation_audit_log",
      eventType: "CENSUS_SENT",
      metadata: expect.objectContaining({
        sentCount: 1,
        automationRunId: "run-1"
      })
    });
  });
});
