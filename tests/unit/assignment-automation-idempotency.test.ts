import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    assignmentActivity: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    assignment: {
      update: vi.fn()
    },
    assignmentResponse: {
      findUnique: vi.fn()
    },
    assignmentInvitation: {
      update: vi.fn(),
      updateMany: vi.fn()
    },
    appNotification: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    replacementCensus: {
      updateMany: vi.fn()
    },
    replacementCensusResponse: {
      updateMany: vi.fn()
    },
    volunteerProfile: {
      update: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    assignment: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn()
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
    appNotification: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    appSetting: {
      upsert: vi.fn()
    },
    notificationLog: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    replacementCensus: {
      findMany: vi.fn()
    },
    replacementCensusResponse: {
      findMany: vi.fn()
    },
    assignmentResponse: {
      findMany: vi.fn()
    },
    scheduleWeek: {
      findMany: vi.fn()
    },
    user: {
      findFirst: vi.fn(),
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
  notifyAdminsForUnresolvedAssignments,
  processAssignmentAutomationRun,
  sendDueAssignmentReminders,
  sendReplacementCensusReminders
} from "@/services/assignment-automation.service";

function automationSettings() {
  return {
    notificationChannels: ["EMAIL"],
    reminderTimingDays: [5, 1],
    finalReminderHours: 3,
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
    censusReminderOffsetsHours: [24, 48],
    adminAlertEmail: "admin@ppam.local"
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
    scheduleWeekId: "week-1",
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

function replacementVolunteer(input: {
  id: string;
  name: string;
  email: string;
  weeklyAvailability?: Array<{
    timeSlot: "SLOT_11_13" | null;
    available: boolean;
  }>;
  confirmationCount?: number;
  futureAssignmentCount?: number;
}) {
  return {
    id: input.id,
    userId: `user-${input.id}`,
    notes: null,
    transportationNotes: null,
    preferredAreas: ["North"],
    reliabilityScore: 90,
    confirmationCount: input.confirmationCount ?? 3,
    declineCount: 0,
    noResponseCount: 0,
    active: true,
    temporaryUnavailable: false,
    canServeAsReplacement: true,
    user: {
      id: `user-${input.id}`,
      name: input.name,
      email: input.email,
      active: true
    },
    availability: [
      {
        id: `availability-${input.id}`,
        volunteerId: input.id,
        dayOfWeek: "SATURDAY",
        timeSlot: "SLOT_11_13",
        areaPreference: "North",
        available: true,
        recurring: true
      }
    ],
    weeklyAvailability: (input.weeklyAvailability ?? []).map((item, index) => ({
      id: `weekly-${input.id}-${index}`,
      censusResponseId: `response-${input.id}`,
      volunteerId: input.id,
      scheduleWeekId: "week-1",
      date: new Date(2026, 5, 20),
      dayOfWeek: "SATURDAY",
      timeSlot: item.timeSlot,
      available: item.available,
      notes: null,
      createdAt: new Date(2026, 5, 16),
      updatedAt: new Date(2026, 5, 16)
    })),
    assignments: Array.from({
      length: input.futureAssignmentCount ?? 0
    }).map((_, index) => ({
      id: `future-${input.id}-${index}`,
      assignmentId: `future-assignment-${index}`,
      volunteerId: input.id,
      position: "FIRST",
      isReplacement: false
    }))
  };
}

function pendingReplacementInvitation(input: {
  id: string;
  volunteerId: string;
  userId: string;
  userName: string;
}) {
  return {
    id: input.id,
    assignmentId: "assignment-1",
    volunteerId: input.volunteerId,
    type: "REPLACEMENT",
    status: "PENDING",
    token: `${input.id}-token`,
    sentAt: null,
    respondedAt: null,
    expiresAt: new Date(2026, 5, 20, 23, 0, 0),
    emailAttempts: 0,
    metadata: {},
    createdAt: new Date(2026, 5, 16, 12, 0, 0),
    updatedAt: new Date(2026, 5, 16, 12, 0, 0),
    assignment: {
      id: "assignment-1",
      date: new Date(2026, 5, 20),
      dayOfWeek: "SATURDAY",
      timeSlot: "SLOT_11_13",
      preachingPoint: {
        name: "Hospital Dr Jose G. Parres"
      }
    },
    volunteer: {
      id: input.volunteerId,
      userId: input.userId,
      user: {
        id: input.userId,
        name: input.userName,
        email: `${input.userId}@example.org`
      }
    }
  };
}

function sentReplacementInvitation() {
  return {
    ...pendingReplacementInvitation({
      id: "replacement-invitation-1",
      volunteerId: "replacement-1",
      userId: "user-replacement-1",
      userName: "Bea"
    }),
    status: "SENT",
    sentAt: new Date(2026, 5, 16, 9, 0, 0),
    expiresAt: new Date(2026, 5, 16, 21, 0, 0),
    metadata: {
      replacementReminderOffsetsHours: [4, 8]
    },
    assignment: {
      id: "assignment-1",
      date: new Date(2026, 5, 20),
      dayOfWeek: "SATURDAY",
      timeSlot: "SLOT_11_13",
      status: "PENDING_CONFIRMATION",
      responses: []
    },
    volunteer: {
      id: "replacement-1",
      userId: "user-replacement-1",
      active: true,
      user: {
        id: "user-replacement-1",
        name: "Bea",
        email: "bea@example.org",
        active: true
      }
    }
  };
}

function pendingPrimaryInvitation() {
  return {
    id: "invitation-1",
    assignmentId: "assignment-1",
    volunteerId: "volunteer-1",
    type: "PRIMARY",
    status: "SENT",
    token: "token-1",
    sentAt: new Date(2026, 5, 16, 9, 0, 0),
    respondedAt: null,
    expiresAt: new Date(2026, 5, 18, 9, 0, 0),
    emailAttempts: 1,
    metadata: {
      primaryReminderOffsetsHours: [12, 24, 40]
    },
    createdAt: new Date(2026, 5, 16, 8, 55, 0),
    updatedAt: new Date(2026, 5, 16, 9, 0, 0),
    assignment: {
      id: "assignment-1",
      date: new Date(2026, 5, 20),
      dayOfWeek: "SATURDAY",
      timeSlot: "SLOT_11_13",
      status: "PENDING_CONFIRMATION",
      responses: []
    },
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
  mocks.db.assignment.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.appNotification.findFirst.mockResolvedValue(null);
  mocks.db.appNotification.create.mockResolvedValue({ id: "app-notification-1" });
  mocks.db.appSetting.upsert.mockResolvedValue({ id: "setting-1" });
  mocks.db.replacementCensus.findMany.mockResolvedValue([]);
  mocks.db.replacementCensusResponse.findMany.mockResolvedValue([]);
  mocks.db.assignmentResponse.findMany.mockResolvedValue([]);
  mocks.db.scheduleWeek.findMany.mockResolvedValue([]);
  mocks.db.user.findFirst.mockResolvedValue({ id: "admin-1" });
  mocks.tx.assignment.update.mockResolvedValue({ id: "assignment-1" });
  mocks.tx.assignmentResponse.findUnique.mockResolvedValue(null);
  mocks.tx.assignmentActivity.findFirst.mockResolvedValue(null);
  mocks.tx.assignmentActivity.create.mockResolvedValue({ id: "activity-1" });
  mocks.tx.assignmentInvitation.update.mockResolvedValue({ id: "invitation-1" });
  mocks.tx.assignmentInvitation.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.appNotification.findFirst.mockResolvedValue(null);
  mocks.tx.appNotification.create.mockResolvedValue({ id: "app-notification-1" });
  mocks.tx.appNotification.updateMany.mockResolvedValue({ count: 0 });
  mocks.tx.replacementCensus.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.replacementCensusResponse.updateMany.mockResolvedValue({ count: 0 });
  mocks.tx.volunteerProfile.update.mockResolvedValue({ id: "volunteer-1" });
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

  it("tries the next replacement candidate when the first invitation email fails", async () => {
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValue(
      replacementAssignment()
    );
    mocks.db.volunteerProfile.findMany.mockResolvedValue([
      replacementVolunteer({
        id: "replacement-1",
        name: "Ana",
        email: "ana@example.org",
        weeklyAvailability: [
          {
            timeSlot: "SLOT_11_13",
            available: true
          }
        ]
      }),
      replacementVolunteer({
        id: "replacement-2",
        name: "Bea",
        email: "bea@example.org",
        weeklyAvailability: [
          {
            timeSlot: null,
            available: true
          }
        ]
      })
    ]);
    mocks.db.assignmentInvitation.findFirst.mockResolvedValue(null);
    mocks.db.assignmentInvitation.create.mockImplementation(async ({ data }) => ({
      id: `invitation-${data.volunteerId}`,
      ...data,
      metadata: data.metadata ?? {}
    }));
    mocks.db.assignmentInvitation.update.mockResolvedValue({
      emailAttempts: 1,
      metadata: {}
    });
    mocks.db.assignmentInvitation.findMany
      .mockResolvedValueOnce([
        pendingReplacementInvitation({
          id: "invitation-replacement-1",
          volunteerId: "replacement-1",
          userId: "user-replacement-1",
          userName: "Ana"
        })
      ])
      .mockResolvedValueOnce([
        pendingReplacementInvitation({
          id: "invitation-replacement-2",
          volunteerId: "replacement-2",
          userId: "user-replacement-2",
          userName: "Bea"
        })
      ]);
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-replacement",
      email: "replacement@example.org"
    });
    mocks.db.notificationLog.create
      .mockResolvedValueOnce({
        id: "notification-failed",
        status: "FAILED",
        sentAt: null,
        errorMessage: "SMTP rejected recipient"
      })
      .mockResolvedValueOnce({
        id: "notification-sent",
        status: "SENT",
        sentAt: new Date("2026-06-16T12:00:00.000Z"),
        errorMessage: null
      });

    const result = await inviteNextAvailableReplacementForAssignment({
      assignmentId: "assignment-1"
    });

    expect(result).toMatchObject({
      status: "invited",
      candidateId: "replacement-2",
      sentCount: 1,
      failedCount: 1
    });
    expect(mocks.db.assignmentInvitation.create).toHaveBeenCalledTimes(2);
    expect(mocks.db.assignment.updateMany).toHaveBeenCalledWith({
      where: {
        id: "assignment-1",
        status: "NEEDS_REPLACEMENT"
      },
      data: {
        status: "PENDING_CONFIRMATION"
      }
    });
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

  it("does not duplicate pending titular response-window reminders", async () => {
    mocks.getAssignmentAutomationSettings.mockResolvedValue(automationSettings());
    mocks.db.assignment.findMany.mockResolvedValue([]);
    mocks.db.assignmentInvitation.findMany.mockResolvedValue([
      pendingPrimaryInvitation()
    ]);
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "julia@example.org"
    });
    mocks.db.notificationLog.create.mockResolvedValue({
      id: "notification-1",
      status: "SENT",
      sentAt: new Date(2026, 5, 16, 21, 30, 0),
      errorMessage: null
    });
    mocks.db.notificationLog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-reminder" });

    const now = new Date(2026, 5, 16, 21, 30, 0);
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
            equals: "pending-confirmation-invitation-1-12h"
          }
        })
      })
    );
  });

  it("does not duplicate pending replacement response-window reminders", async () => {
    mocks.getAssignmentAutomationSettings.mockResolvedValue(automationSettings());
    mocks.db.assignment.findMany.mockResolvedValue([]);
    mocks.db.assignmentInvitation.findMany.mockResolvedValue([
      sentReplacementInvitation()
    ]);
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-replacement-1",
      email: "bea@example.org"
    });
    mocks.db.notificationLog.create.mockResolvedValue({
      id: "notification-1",
      status: "SENT",
      sentAt: new Date(2026, 5, 16, 13, 30, 0),
      errorMessage: null
    });
    mocks.db.notificationLog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-reminder" });

    const now = new Date(2026, 5, 16, 13, 30, 0);
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
            equals: "pending-confirmation-replacement-invitation-1-4h"
          }
        })
      })
    );
  });

  it("uses configured replacement census reminder offsets", async () => {
    mocks.getAssignmentAutomationSettings.mockResolvedValue(automationSettings());
    mocks.db.replacementCensusResponse.findMany.mockResolvedValue([
      {
        id: "census-response-1",
        censusId: "census-1",
        token: "census-token",
        expiresAt: new Date("2026-06-18T12:00:00.000Z"),
        census: {
          scheduleWeekId: "week-1",
          scheduleWeek: {
            startDate: new Date("2026-06-15T00:00:00.000Z"),
            endDate: new Date("2026-06-21T00:00:00.000Z")
          }
        },
        volunteer: {
          userId: "user-1",
          user: {
            name: "Julia"
          }
        }
      }
    ]);
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "julia@example.org"
    });
    mocks.db.notificationLog.findFirst.mockResolvedValue(null);
    mocks.db.notificationLog.create.mockResolvedValue({
      id: "notification-1",
      status: "SENT",
      sentAt: new Date("2026-06-16T12:00:00.000Z"),
      errorMessage: null
    });

    const now = new Date("2026-06-16T12:00:00.000Z");
    const result = await sendReplacementCensusReminders({ now });

    expect(result).toMatchObject({
      processedCount: 1,
      sentCount: 1,
      duplicateCount: 0
    });
    expect(mocks.db.replacementCensusResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiresAt: {
            gt: now,
            lte: new Date("2026-06-18T12:00:00.000Z")
          }
        })
      })
    );
    expect(mocks.db.notificationLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          metadata: {
            path: ["reminderKey"],
            equals: "census-reminder:census-response-1:48h"
          }
        })
      })
    );
    expect(mocks.db.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            reminderKey: "census-reminder:census-response-1:48h",
            reminderOffsetHours: 48
          })
        })
      })
    );
  });

  it("creates internal admin notifications for low-response replacement census", async () => {
    mocks.db.assignmentInvitation.findMany.mockResolvedValue([]);
    mocks.db.assignment.findMany.mockResolvedValue([]);
    mocks.db.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mocks.db.replacementCensus.findMany.mockResolvedValue([
      {
        id: "census-1",
        scheduleWeekId: "week-1",
        closesAt: new Date("2026-06-17T12:00:00.000Z"),
        scheduleWeek: {
          startDate: new Date("2026-06-15T00:00:00.000Z"),
          endDate: new Date("2026-06-21T00:00:00.000Z")
        },
        responses: [
          { status: "SUBMITTED" },
          { status: "SENT" },
          { status: "PENDING" }
        ]
      }
    ]);

    const result = await notifyAdminsForUnresolvedAssignments({
      now: new Date("2026-06-16T12:00:00.000Z")
    });

    expect(result).toMatchObject({
      processedCount: 1,
      alertedCount: 1,
      duplicateCount: 0
    });
    expect(mocks.db.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "admin-1",
          censusId: "census-1",
          type: "ADMIN_ATTENTION_REQUIRED",
          priority: "HIGH",
          title: "Censo con baja respuesta"
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

    expect(firstRun.failedStepCount).toBe(0);
    expect(firstRun.summarySaved).toBe(true);
    expect(secondRun.failedStepCount).toBe(0);
    expect(secondRun.summarySaved).toBe(true);
    expect(firstRun.sendDueAssignmentReminders.sentCount).toBe(1);
    expect(secondRun.sendDueAssignmentReminders.duplicateCount).toBe(1);
    expect(mocks.db.notificationLog.create).toHaveBeenCalledTimes(1);
  });
});
