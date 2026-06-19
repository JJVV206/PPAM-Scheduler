import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    appNotification: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    replacementCensus: {
      create: vi.fn(),
      update: vi.fn()
    },
    replacementCensusResponse: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    replacementWeeklyAvailability: {
      createMany: vi.fn(),
      deleteMany: vi.fn()
    },
    scheduleWeek: {
      findUniqueOrThrow: vi.fn()
    },
    volunteerProfile: {
      findMany: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    replacementCensusResponse: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  };

  return {
    db,
    tx,
    getAssignmentAutomationSettings: vi.fn(),
    sendEmailNotification: vi.fn()
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/lib/env/config", () => ({
  getAppBaseUrl: () => "https://ppam.example.org"
}));
vi.mock("@/services/notification.service", () => ({
  sendEmailNotification: mocks.sendEmailNotification
}));
vi.mock("@/services/setting.service", () => ({
  getAssignmentAutomationSettings: mocks.getAssignmentAutomationSettings
}));

import {
  buildReplacementCensusResponseUrl,
  getReplacementCensusResponseContext,
  openReplacementCensusForWeek,
  sendPendingReplacementCensusInvitations,
  submitReplacementCensusResponse
} from "@/services/replacement-census.service";

const week = {
  id: "week-1",
  startDate: new Date("2026-06-15T00:00:00.000Z"),
  endDate: new Date("2026-06-21T00:00:00.000Z"),
  label: "Del 15 al 21 de junio de 2026",
  createdById: "admin-1",
  createdAt: new Date("2026-06-10T00:00:00.000Z")
};

function pendingCensusResponse() {
  return {
    id: "response-1",
    censusId: "census-1",
    volunteerId: "volunteer-1",
    status: "PENDING",
    token: "census token",
    sentAt: null,
    respondedAt: null,
    expiresAt: new Date("2026-06-18T12:00:00.000Z"),
    emailAttempts: 0,
    metadata: {},
    createdAt: new Date("2026-06-16T12:00:00.000Z"),
    updatedAt: new Date("2026-06-16T12:00:00.000Z"),
    census: {
      id: "census-1",
      scheduleWeekId: "week-1",
      status: "OPEN",
      sentAt: null,
      closesAt: new Date("2026-06-18T12:00:00.000Z"),
      createdById: "admin-1",
      metadata: {},
      createdAt: new Date("2026-06-16T12:00:00.000Z"),
      updatedAt: new Date("2026-06-16T12:00:00.000Z"),
      scheduleWeek: week
    },
    volunteer: {
      id: "volunteer-1",
      userId: "user-1",
      user: {
        id: "user-1",
        name: "Julia",
        email: "julia@example.org",
        active: true
      }
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAssignmentAutomationSettings.mockResolvedValue({
    censusResponseTimeoutHours: 72
  });
  mocks.tx.appNotification.findFirst.mockResolvedValue(null);
  mocks.tx.appNotification.create.mockResolvedValue({
    id: "app-notification-1"
  });
});

describe("replacement census preparation", () => {
  it("builds token-based census response URLs", () => {
    expect(buildReplacementCensusResponseUrl("abc 123")).toBe(
      "https://ppam.example.org/replacement-census/abc%20123"
    );
  });

  it("opens a weekly census and creates missing responses for active replacements", async () => {
    const closesAt = new Date("2026-06-18T12:00:00.000Z");
    mocks.tx.scheduleWeek.findUniqueOrThrow.mockResolvedValue({
      ...week,
      census: null
    });
    mocks.tx.replacementCensus.create.mockResolvedValue({
      id: "census-1",
      scheduleWeekId: "week-1",
      status: "OPEN",
      sentAt: null,
      closesAt,
      createdById: "admin-1",
      metadata: {},
      createdAt: new Date("2026-06-16T12:00:00.000Z"),
      updatedAt: new Date("2026-06-16T12:00:00.000Z")
    });
    mocks.tx.volunteerProfile.findMany.mockResolvedValue([
      { id: "volunteer-1", userId: "user-1" },
      { id: "volunteer-2", userId: "user-2" }
    ]);
    mocks.tx.replacementCensusResponse.findMany.mockResolvedValue([
      { volunteerId: "volunteer-2" }
    ]);
    mocks.tx.replacementCensusResponse.create.mockResolvedValue({
      id: "response-1"
    });

    const result = await openReplacementCensusForWeek({
      scheduleWeekId: "week-1",
      actorUserId: "admin-1",
      closesAt
    });

    expect(result).toMatchObject({
      replacementCount: 2,
      createdResponseCount: 1,
      skippedResponseCount: 1
    });
    expect(mocks.tx.replacementCensus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduleWeekId: "week-1",
          status: "OPEN",
          closesAt,
          createdById: "admin-1"
        })
      })
    );
    expect(mocks.tx.replacementCensusResponse.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.replacementCensusResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          censusId: "census-1",
          volunteerId: "volunteer-1",
          expiresAt: closesAt
        })
      })
    );
    expect(mocks.tx.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          censusId: "census-1",
          type: "CENSUS_PENDING"
        })
      })
    );
  });

  it("does not duplicate census responses when the weekly census is opened again", async () => {
    const closesAt = new Date("2026-06-18T12:00:00.000Z");
    mocks.tx.scheduleWeek.findUniqueOrThrow.mockResolvedValue({
      ...week,
      census: {
        id: "census-1",
        scheduleWeekId: "week-1",
        status: "OPEN",
        sentAt: null,
        closesAt,
        createdById: "admin-1",
        metadata: {
          openedBy: "week_preparation"
        },
        createdAt: new Date("2026-06-16T12:00:00.000Z"),
        updatedAt: new Date("2026-06-16T12:00:00.000Z")
      }
    });
    mocks.tx.volunteerProfile.findMany.mockResolvedValue([
      { id: "volunteer-1", userId: "user-1" },
      { id: "volunteer-2", userId: "user-2" }
    ]);
    mocks.tx.replacementCensusResponse.findMany.mockResolvedValue([
      { volunteerId: "volunteer-1" },
      { volunteerId: "volunteer-2" }
    ]);

    const result = await openReplacementCensusForWeek({
      scheduleWeekId: "week-1",
      actorUserId: "admin-1",
      closesAt
    });

    expect(result).toMatchObject({
      replacementCount: 2,
      createdResponseCount: 0,
      skippedResponseCount: 2
    });
    expect(mocks.tx.replacementCensus.create).not.toHaveBeenCalled();
    expect(mocks.tx.replacementCensusResponse.create).not.toHaveBeenCalled();
    expect(mocks.tx.appNotification.create).not.toHaveBeenCalled();
  });

  it("sends pending census emails and marks responses as sent", async () => {
    mocks.db.replacementCensusResponse.findMany.mockResolvedValue([
      pendingCensusResponse()
    ]);
    mocks.db.replacementCensusResponse.update.mockResolvedValue({
      emailAttempts: 1,
      metadata: {}
    });
    mocks.sendEmailNotification.mockResolvedValue({
      id: "notification-1",
      status: "SENT",
      sentAt: new Date("2026-06-16T12:05:00.000Z"),
      errorMessage: null
    });
    mocks.tx.replacementCensusResponse.update.mockResolvedValue({
      id: "response-1"
    });
    mocks.tx.replacementCensus.update.mockResolvedValue({
      id: "census-1"
    });

    const result = await sendPendingReplacementCensusInvitations({
      censusId: "census-1"
    });

    expect(result).toMatchObject({
      totalCount: 1,
      sentCount: 1,
      failedCount: 0
    });
    expect(mocks.sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "CENSUS_REQUEST",
        metadata: expect.objectContaining({
          censusId: "census-1",
          censusResponseId: "response-1",
          scheduleWeekId: "week-1"
        })
      })
    );
    expect(mocks.tx.replacementCensusResponse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "response-1" },
        data: expect.objectContaining({
          status: "SENT"
        })
      })
    );
  });

  it("loads public token census context with only minimum volunteer data", async () => {
    mocks.db.replacementCensusResponse.findUnique.mockResolvedValue({
      id: "response-1",
      censusId: "census-1",
      volunteerId: "volunteer-1",
      status: "SENT",
      token: "token-1",
      sentAt: new Date("2026-06-16T12:00:00.000Z"),
      respondedAt: null,
      expiresAt: new Date("2099-06-18T12:00:00.000Z"),
      emailAttempts: 1,
      metadata: {},
      createdAt: new Date("2026-06-16T12:00:00.000Z"),
      updatedAt: new Date("2026-06-16T12:00:00.000Z"),
      census: {
        id: "census-1",
        scheduleWeekId: "week-1",
        scheduleWeek: week
      },
      volunteer: {
        id: "volunteer-1",
        userId: "user-1",
        user: {
          id: "user-1",
          name: "Julia",
          email: "julia@example.org"
        }
      },
      availability: [
        {
          date: new Date("2026-06-15T12:00:00.000Z"),
          dayOfWeek: "MONDAY",
          timeSlot: null,
          available: true,
          notes: null
        }
      ]
    });

    const context = await getReplacementCensusResponseContext("token-1");

    expect(context).toMatchObject({
      state: "READY",
      token: "token-1",
      responseId: "response-1",
      censusId: "census-1",
      volunteerName: "Julia",
      availability: [
        expect.objectContaining({
          dayOfWeek: "MONDAY",
          timeSlot: null,
          available: true
        })
      ]
    });
    expect(context).not.toHaveProperty("email");
    expect(context).not.toHaveProperty("volunteerId");
  });

  it("stores weekly availability from a token response", async () => {
    mocks.db.replacementCensusResponse.findUnique.mockResolvedValue({
      id: "response-1",
      censusId: "census-1",
      volunteerId: "volunteer-1",
      status: "SENT",
      expiresAt: new Date("2099-06-18T12:00:00.000Z"),
      respondedAt: null,
      metadata: {},
      census: {
        scheduleWeekId: "week-1"
      }
    });
    mocks.tx.replacementWeeklyAvailability.deleteMany.mockResolvedValue({
      count: 0
    });
    mocks.tx.replacementWeeklyAvailability.createMany.mockResolvedValue({
      count: 8
    });
    mocks.tx.replacementCensusResponse.update.mockResolvedValue({
      id: "response-1"
    });
    mocks.tx.appNotification.updateMany.mockResolvedValue({
      count: 1
    });

    const result = await submitReplacementCensusResponse({
      token: "token-1",
      days: [
        {
          date: new Date("2026-06-15T12:00:00.000Z"),
          dayOfWeek: "MONDAY",
          available: true,
          timeSlots: ["SLOT_09_11", "SLOT_11_13"],
          notes: "Preferencia por la mañana"
        },
        {
          date: new Date("2026-06-16T12:00:00.000Z"),
          dayOfWeek: "TUESDAY",
          available: true
        },
        {
          date: new Date("2026-06-17T12:00:00.000Z"),
          dayOfWeek: "WEDNESDAY",
          available: false
        },
        {
          date: new Date("2026-06-18T12:00:00.000Z"),
          dayOfWeek: "THURSDAY",
          available: false
        },
        {
          date: new Date("2026-06-19T12:00:00.000Z"),
          dayOfWeek: "FRIDAY",
          available: false
        },
        {
          date: new Date("2026-06-20T12:00:00.000Z"),
          dayOfWeek: "SATURDAY",
          available: false
        },
        {
          date: new Date("2026-06-21T12:00:00.000Z"),
          dayOfWeek: "SUNDAY",
          available: false
        }
      ]
    });

    expect(result).toEqual({
      responseId: "response-1",
      status: "SUBMITTED",
      savedAvailabilityCount: 8
    });
    expect(
      mocks.tx.replacementWeeklyAvailability.createMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: "MONDAY",
            timeSlot: "SLOT_09_11",
            available: true
          }),
          expect.objectContaining({
            dayOfWeek: "MONDAY",
            timeSlot: "SLOT_11_13",
            available: true
          }),
          expect.objectContaining({
            dayOfWeek: "TUESDAY",
            timeSlot: null,
            available: true
          }),
          expect.objectContaining({
            dayOfWeek: "WEDNESDAY",
            timeSlot: null,
            available: false
          })
        ])
      })
    );
    expect(mocks.tx.replacementCensusResponse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "response-1" },
        data: expect.objectContaining({
          status: "SUBMITTED"
        })
      })
    );
    expect(mocks.tx.appNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          readAt: expect.any(Date)
        }
      })
    );
  });
});
