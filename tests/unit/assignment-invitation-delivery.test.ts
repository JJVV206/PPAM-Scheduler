import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    assignmentActivity: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    assignmentInvitation: {
      update: vi.fn()
    },
    appNotification: {
      create: vi.fn(),
      findFirst: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    assignment: {
      findUniqueOrThrow: vi.fn()
    },
    assignmentActivity: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    assignmentInvitation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    notificationLog: {
      create: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  };

  return {
    db,
    tx,
    getAssignmentAutomationSettings: vi.fn()
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/lib/env/config", () => ({
  getAppBaseUrl: () => "https://ppam.example.org",
  getSmtpConfig: () => null
}));
vi.mock("@/services/setting.service", () => ({
  getAssignmentAutomationSettings: mocks.getAssignmentAutomationSettings
}));

import {
  createPendingPrimaryInvitationsForAssignment,
  createPendingReplacementInvitationForAssignment,
  sendPendingPrimaryInvitationsForAssignment
} from "@/services/assignment-invitation.service";

function pendingPrimaryInvitation() {
  return {
    id: "invitation-1",
    assignmentId: "assignment-1",
    volunteerId: "volunteer-1",
    type: "PRIMARY",
    status: "PENDING",
    token: "token-1",
    sentAt: null,
    respondedAt: null,
    expiresAt: new Date("2026-06-18T12:00:00.000Z"),
    emailAttempts: 0,
    metadata: {},
    createdAt: new Date("2026-06-16T12:00:00.000Z"),
    updatedAt: new Date("2026-06-16T12:00:00.000Z"),
    assignment: {
      id: "assignment-1",
      date: new Date("2026-06-20T00:00:00.000Z"),
      dayOfWeek: "SATURDAY",
      timeSlot: "SLOT_11_13",
      preachingPoint: {
        name: "Hospital Dr Jose G. Parres"
      }
    },
    volunteer: {
      id: "volunteer-1",
      userId: "user-1",
      user: {
        id: "user-1",
        name: "Julia",
        email: "julia@example.org"
      }
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAssignmentAutomationSettings.mockResolvedValue({
    primaryResponseTimeoutHours: 48,
    primaryReminderOffsetsHours: [12, 24, 40],
    urgentPrimaryResponseTimeoutHours: 12,
    urgentPrimaryReminderOffsetsHours: [4, 8],
    urgentThresholdHours: 72,
    replacementResponseTimeoutHours: 12,
    replacementReminderOffsetsHours: [4, 8],
    urgentReplacementResponseTimeoutHours: 4,
    urgentReplacementReminderOffsetsHours: [2],
    censusResponseTimeoutHours: 72,
    finalReminderHours: 3,
    reminderTimingDays: [5, 1],
    notificationChannels: ["EMAIL"]
  });
  mocks.db.assignment.findUniqueOrThrow.mockResolvedValue({
    date: new Date(2026, 5, 20),
    timeSlot: "SLOT_11_13"
  });
  mocks.db.assignmentActivity.findFirst.mockResolvedValue(null);
  mocks.db.assignmentActivity.create.mockResolvedValue({ id: "activity-1" });
  mocks.db.assignmentInvitation.findFirst.mockResolvedValue(null);
  mocks.tx.assignmentActivity.findFirst.mockResolvedValue(null);
  mocks.tx.assignmentActivity.create.mockResolvedValue({ id: "activity-1" });
  mocks.tx.appNotification.findFirst.mockResolvedValue(null);
  mocks.tx.appNotification.create.mockResolvedValue({ id: "app-notification-1" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("assignment invitation delivery QA", () => {
  it("creates titular invitations without duplicating active invitations", async () => {
    mocks.db.assignmentInvitation.findMany.mockResolvedValue([
      { volunteerId: "volunteer-2" }
    ]);
    mocks.db.assignmentInvitation.create.mockImplementation(async ({ data }) => ({
      id: `invitation-${data.volunteerId}`,
      ...data
    }));

    const result = await createPendingPrimaryInvitationsForAssignment({
      assignmentId: "assignment-1",
      volunteerIds: ["volunteer-1", "volunteer-2", "volunteer-1"],
      actorUserId: "admin-1",
      source: "assignment_created"
    });

    expect(result).toEqual({ createdCount: 1, skippedCount: 1 });
    expect(mocks.db.assignmentInvitation.create).toHaveBeenCalledTimes(1);
    expect(mocks.db.assignmentInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId: "assignment-1",
          volunteerId: "volunteer-1",
          type: "PRIMARY"
        })
      })
    );
    expect(mocks.db.assignmentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "INVITATION_CREATED"
        })
      })
    );
  });

  it("compresses titular response windows when the assignment is close", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 12, 0, 0));
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValue({
      date: new Date(2026, 5, 17),
      timeSlot: "SLOT_11_13"
    });
    mocks.db.assignmentInvitation.findMany.mockResolvedValue([]);
    mocks.db.assignmentInvitation.create.mockImplementation(async ({ data }) => ({
      id: `invitation-${data.volunteerId}`,
      ...data
    }));

    await createPendingPrimaryInvitationsForAssignment({
      assignmentId: "assignment-1",
      volunteerIds: ["volunteer-1"],
      actorUserId: "admin-1",
      source: "week_preparation"
    });

    expect(mocks.db.assignmentInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: new Date(2026, 5, 17, 0, 0, 0),
          metadata: expect.objectContaining({
            primaryResponseTimeoutHours: 12,
            primaryReminderOffsetsHours: [4, 8],
            urgentPrimaryWindow: true,
            urgentThresholdHours: 72
          })
        })
      })
    );
  });

  it("compresses replacement response windows when the assignment is urgent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 6, 0, 0));
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValue({
      date: new Date(2026, 5, 20),
      timeSlot: "SLOT_11_13"
    });
    mocks.db.assignmentInvitation.create.mockImplementation(async ({ data }) => ({
      id: `invitation-${data.volunteerId}`,
      ...data
    }));

    const result = await createPendingReplacementInvitationForAssignment({
      assignmentId: "assignment-1",
      volunteerId: "replacement-1",
      actorUserId: "admin-1"
    });

    expect(result).toEqual({ createdCount: 1, skippedCount: 0 });
    expect(mocks.db.assignmentInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId: "assignment-1",
          volunteerId: "replacement-1",
          type: "REPLACEMENT",
          expiresAt: new Date(2026, 5, 20, 10, 0, 0),
          metadata: expect.objectContaining({
            replacementResponseTimeoutHours: 4,
            replacementReminderOffsetsHours: [2],
            urgentReplacementWindow: true
          })
        })
      })
    );
  });

  it("sends a titular invitation email and records NotificationLog plus audit activity", async () => {
    mocks.db.assignmentInvitation.findMany.mockResolvedValue([
      pendingPrimaryInvitation()
    ]);
    mocks.db.assignmentInvitation.update.mockResolvedValue({
      emailAttempts: 1,
      metadata: {}
    });
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "julia@example.org"
    });
    mocks.db.notificationLog.create.mockResolvedValue({
      id: "notification-1",
      status: "SENT",
      sentAt: new Date("2026-06-16T12:05:00.000Z"),
      errorMessage: null
    });

    const result = await sendPendingPrimaryInvitationsForAssignment({
      assignmentId: "assignment-1",
      actorUserId: "admin-1"
    });

    expect(result).toMatchObject({
      totalCount: 1,
      sentCount: 1,
      failedCount: 0
    });
    expect(mocks.db.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          assignmentId: "assignment-1",
          type: "CONFIRMATION_REQUEST",
          channel: "EMAIL",
          status: "SENT"
        })
      })
    );
    expect(mocks.tx.assignmentInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SENT"
        })
      })
    );
    expect(mocks.tx.assignmentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "INVITATION_SENT"
        })
      })
    );
  });
});
