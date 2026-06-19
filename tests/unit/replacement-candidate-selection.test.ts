import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    assignment: {
      findUniqueOrThrow: vi.fn()
    },
    volunteerProfile: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import { getReplacementCandidatesForAssignment } from "@/services/replacement-candidate.service";

function assignment() {
  return {
    id: "assignment-1",
    scheduleWeekId: "week-1",
    date: new Date(2026, 5, 20),
    dayOfWeek: "SATURDAY",
    timeSlot: "SLOT_11_13",
    preachingPoint: {
      area: "North"
    },
    volunteers: [
      {
        volunteerId: "primary-1"
      }
    ],
    responses: [
      {
        volunteerId: "declined-1",
        responseStatus: "DECLINED"
      },
      {
        volunteerId: "confirmed-1",
        responseStatus: "CONFIRMED"
      }
    ],
    invitations: [
      {
        volunteerId: "attempted-1",
        type: "REPLACEMENT"
      },
      {
        volunteerId: "primary-2",
        type: "PRIMARY"
      }
    ]
  };
}

function candidate(input: {
  id: string;
  name: string;
  weeklyAvailability?: Array<{
    timeSlot: "SLOT_11_13" | null;
    available: boolean;
  }>;
  recurring?: boolean;
}) {
  return {
    id: input.id,
    userId: `user-${input.id}`,
    notes: null,
    transportationNotes: null,
    preferredAreas: ["North"],
    reliabilityScore: 90,
    confirmationCount: 4,
    declineCount: 1,
    noResponseCount: 0,
    active: true,
    temporaryUnavailable: false,
    canServeAsReplacement: true,
    user: {
      id: `user-${input.id}`,
      name: input.name,
      email: `${input.id}@example.org`,
      phone: "5551234567",
      active: true
    },
    availability: [
      {
        id: `availability-${input.id}`,
        dayOfWeek: "SATURDAY",
        timeSlot: "SLOT_11_13",
        areaPreference: "North",
        available: true,
        recurring: input.recurring ?? false
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
    assignments: []
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.assignment.findUniqueOrThrow.mockResolvedValue(assignment());
});

describe("replacement candidate selection QA", () => {
  it("excludes primary, declined, and already attempted volunteers before ranking candidates", async () => {
    mocks.db.volunteerProfile.findMany.mockResolvedValue([
      candidate({
        id: "day-1",
        name: "Day Candidate",
        weeklyAvailability: [
          {
            timeSlot: null,
            available: true
          }
        ]
      }),
      candidate({
        id: "attempted-1",
        name: "Attempted Candidate",
        weeklyAvailability: [
          {
            timeSlot: "SLOT_11_13",
            available: true
          }
        ]
      }),
      candidate({
        id: "general-1",
        name: "General Candidate",
        recurring: true
      }),
      candidate({
        id: "exact-1",
        name: "Exact Candidate",
        weeklyAvailability: [
          {
            timeSlot: "SLOT_11_13",
            available: true
          }
        ]
      })
    ]);

    const ranked = await getReplacementCandidatesForAssignment({
      assignmentId: "assignment-1"
    });

    expect(mocks.db.volunteerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            notIn: ["primary-1", "declined-1", "attempted-1"]
          }
        })
      })
    );
    expect(ranked.map((item) => item.id)).toEqual([
      "exact-1",
      "day-1",
      "general-1"
    ]);
    expect(ranked.map((item) => item.replacementPriority.availabilitySource)).toEqual([
      "WEEKLY_EXACT",
      "WEEKLY_DAY",
      "RECURRING_EXACT"
    ]);
  });
});
