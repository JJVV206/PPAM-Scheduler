import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    assignmentActivity: {
      create: vi.fn(),
      findFirst: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    assignment: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    assignmentActivity: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    assignmentInvitation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    notificationLog: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    volunteerProfile: {
      findMany: vi.fn()
    }
  };

  return {
    db,
    tx,
    getAssignmentAutomationSettings: vi.fn(),
    getAppSettings: vi.fn()
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/lib/env/config", () => ({
  getAppBaseUrl: () => "https://ppam.example.org",
  getSmtpConfig: () => null
}));
vi.mock("@/services/setting.service", () => ({
  getAppSettings: mocks.getAppSettings,
  getAssignmentAutomationSettings: mocks.getAssignmentAutomationSettings
}));

import {
  inviteNextAvailableReplacementForAssignment,
  processAssignmentAutomationRun,
  sendDueAssignmentReminders
} from "@/services/assignment-automation.service";

function automationSettings() {
  return {
    notificationChannels: ["EMAIL"],
    reminderTimingDays: [5, 1],
    finalReminderHours: 3,
    primaryResponseTimeoutHours: 48,
    replacementResponseTimeoutHours: 12
  };
}

function confirmedAssignment() {
  return {
    id: "assignment-1",
    date: new Date(2026, 5, 20),
    dayOfWeek: "SATURDAY",
    timeSlot: "SLOT_11_13",
    status: "SCHEDULED",
    responses: [
      {
        id: "response-1",
        volunteerId: "volunteer-1",
        responseStatus: "CONFIRMED"
      }
    ],
    volunteers: [
      {
        id: "slot-1",
        volunteerId: "volunteer-1",
        volunteer: {
          id: "volunteer-1",
          userId: "user-1",
          active: true,
          user: {
            id: "user-1",
            name: "Julia",
            email: "julia@example.org",
            active: true
          }
        }
      }
    ]
  };
}

function replacementAssignment(status = "NEEDS_REPLACEMENT") {
  return {
    id: "assignment-1",
    status,
    date: new Date(2026, 5, 20),
    dayOfWeek: "SATURDAY",
    timeSlot: "SLOT_11_13",
    invitations: [],
    volunteers: [],
    responses: [],
    preachingPoint: {
      name: "Hospital Dr Jose G. Parres",
      area: "North"
    }
  };
}

function setupReminderMocks() {
  mocks.getAssignmentAutomationSettings.mockResolvedValue(automationSettings());
  mocks.db.assignment.findMany.mockImplementation(async ({ where }) => {
    if (where?.responses?.some?.responseStatus === "CONFIRMED") {
      return [confirmedAssignment()];
    }

    return [];
  });
  mocks.db.assignmentInvitation.findMany.mockResolvedValue([]);
  mocks.db.user.findUnique.mockResolvedValue({
    id: "user-1",
    email: "julia@example.org"
  });
  mocks.db.notificationLog.create.mockResolvedValue({
    id: "notification-1",
    status: "SENT",
    sentAt: new Date("2026-06-15T11:00:00.000Z"),
    errorMessage: null
  });
  mocks.db.assignmentActivity.findFirst.mockResolvedValue(null);
  mocks.db.assignmentActivity.create.mockResolvedValue({ id: "activity-1" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAssignmentAutomationSettings.mockResolvedValue(automationSettings());
  mocks.getAppSettings.mockResolvedValue({ confirmationLeadDays: 7 });
  mocks.db.assignmentActivity.findFirst.mockResolvedValue(null);
  mocks.db.assignmentActivity.create.mockResolvedValue({ id: "activity-1" });
  mocks.tx.assignmentActivity.findFirst.mockResolvedValue(null);
  mocks.tx.assignmentActivity.create.mockResolvedValue({ id: "activity-1" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("assignment automation idempotency QA", () => {
  it("alerts admins by email when no replacement candidate is available", async () => {
    mocks.db.assignment.findUniqueOrThrow
      .mockResolvedValueOnce(replacementAssignment())
      .mockResolvedValueOnce(replacementAssignment())
      .mockResolvedValueOnce(replacementAssignment());
    mocks.db.volunteerProfile.findMany.mockResolvedValue([]);
    mocks.db.user.findMany.mockResolvedValue([
      { id: "admin-1", active: true, role: "ADMIN", email: "admin@example.org" }
    ]);
    mocks.db.user.findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.org"
    });
    mocks.db.notificationLog.create.mockResolvedValue({
      id: "admin-notification-1",
      status: "SENT",
      sentAt: new Date("2026-06-16T12:00:00.000Z"),
      errorMessage: null
    });

    const result = await inviteNextAvailableReplacementForAssignment({
      assignmentId: "assignment-1"
    });

    expect(result).toMatchObject({
      status: "no_candidate",
      sentCount: 0,
      failedCount: 0
    });
    expect(mocks.db.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "admin-1",
          assignmentId: "assignment-1",
          type: "ASSIGNMENT_UPDATE",
          channel: "EMAIL",
          status: "SENT"
        })
      })
    );
    expect(mocks.db.assignmentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "ADMIN_ALERTED"
        })
      })
    );
  });

  it.each([
    {
      name: "five-day reminders",
      now: new Date(2026, 5, 15, 11, 0, 0),
      expectedKey: "confirmed-5d"
    },
    {
      name: "one-day reminders",
      now: new Date(2026, 5, 19, 11, 0, 0),
      expectedKey: "confirmed-1d"
    },
    {
      name: "final-hour reminders",
      now: new Date(2026, 5, 20, 8, 30, 0),
      expectedKey: "confirmed-final-3h"
    }
  ])("does not duplicate $name", async ({ now, expectedKey }) => {
    setupReminderMocks();
    mocks.db.notificationLog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-reminder" });

    const firstRun = await sendDueAssignmentReminders({ now });
    const secondRun = await sendDueAssignmentReminders({ now });

    expect(firstRun).toMatchObject({ sentCount: 1, duplicateCount: 0 });
    expect(secondRun).toMatchObject({ sentCount: 0, duplicateCount: 1 });
    expect(mocks.db.notificationLog.create).toHaveBeenCalledTimes(1);
    expect(mocks.db.notificationLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          metadata: {
            path: ["reminderKey"],
            equals: expectedKey
          }
        })
      })
    );
  });

  it("can run the cron automation twice without sending duplicate reminder emails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 0, 0));
    setupReminderMocks();
    mocks.db.assignmentInvitation.findMany.mockResolvedValue([]);
    mocks.db.notificationLog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-reminder" });

    const firstRun = await processAssignmentAutomationRun();
    const secondRun = await processAssignmentAutomationRun();

    expect(firstRun.sendDueAssignmentReminders.sentCount).toBe(1);
    expect(secondRun.sendDueAssignmentReminders.duplicateCount).toBe(1);
    expect(mocks.db.notificationLog.create).toHaveBeenCalledTimes(1);
  });
});
