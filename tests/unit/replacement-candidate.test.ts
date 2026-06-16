import { describe, expect, it } from "vitest";

import {
  getReplacementAvailabilityMatch,
  rankReplacementCandidates,
  type ReplacementCandidatePriority
} from "@/services/replacement-candidate.service";

function priority(
  overrides: Partial<ReplacementCandidatePriority> = {}
): ReplacementCandidatePriority {
  return {
    availabilitySource: "WEEKLY_EXACT",
    availabilityRank: 3,
    weeklyExactAvailability: true,
    weeklyDayAvailability: false,
    recurringAvailability: false,
    exactAvailability: true,
    markedAsReplacement: true,
    areaCompatible: true,
    confirmationRate: 0.8,
    reliabilityScore: 90,
    futureAssignmentCount: 2,
    attemptedBefore: false,
    ...overrides
  };
}

describe("getReplacementAvailabilityMatch", () => {
  it("prioritizes exact weekly census availability", () => {
    expect(
      getReplacementAvailabilityMatch({
        weeklyAvailability: [
          {
            timeSlot: "SLOT_11_13",
            available: true
          }
        ],
        recurringAvailability: [],
        timeSlot: "SLOT_11_13"
      })
    ).toMatchObject({
      source: "WEEKLY_EXACT",
      rank: 3,
      unavailable: false
    });
  });

  it("uses weekly day availability before recurring availability", () => {
    expect(
      getReplacementAvailabilityMatch({
        weeklyAvailability: [
          {
            timeSlot: null,
            available: true
          }
        ],
        recurringAvailability: [
          {
            timeSlot: "SLOT_11_13",
            available: true,
            recurring: true
          }
        ],
        timeSlot: "SLOT_11_13"
      })
    ).toMatchObject({
      source: "WEEKLY_DAY",
      rank: 2
    });
  });

  it("excludes explicit weekly unavailability", () => {
    expect(
      getReplacementAvailabilityMatch({
        weeklyAvailability: [
          {
            timeSlot: null,
            available: false
          }
        ],
        recurringAvailability: [
          {
            timeSlot: "SLOT_11_13",
            available: true,
            recurring: true
          }
        ],
        timeSlot: "SLOT_11_13"
      })
    ).toMatchObject({
      source: "UNAVAILABLE",
      rank: -1,
      unavailable: true
    });
  });
});

describe("rankReplacementCandidates", () => {
  it("prioritizes weekly exact, weekly day, and recurring availability first", () => {
    const ranked = rankReplacementCandidates([
      {
        name: "Recurring Candidate",
        replacementPriority: priority({
          availabilitySource: "RECURRING_EXACT",
          availabilityRank: 1,
          weeklyExactAvailability: false,
          recurringAvailability: true,
          exactAvailability: false
        })
      },
      {
        name: "Day Candidate",
        replacementPriority: priority({
          availabilitySource: "WEEKLY_DAY",
          availabilityRank: 2,
          weeklyExactAvailability: false,
          weeklyDayAvailability: true,
          exactAvailability: false
        })
      },
      {
        name: "Exact Candidate",
        replacementPriority: priority()
      }
    ]);

    expect(ranked.map((candidate) => candidate.name)).toEqual([
      "Exact Candidate",
      "Day Candidate",
      "Recurring Candidate"
    ]);
  });

  it("uses area fit, confirmation history, future load, and name as stable tiebreakers", () => {
    const ranked = rankReplacementCandidates([
      {
        name: "Zoe",
        replacementPriority: priority({
          areaCompatible: false,
          confirmationRate: 1,
          futureAssignmentCount: 0
        })
      },
      {
        name: "Ana",
        replacementPriority: priority({
          confirmationRate: 0.92,
          reliabilityScore: 96,
          futureAssignmentCount: 3
        })
      },
      {
        name: "Bea",
        replacementPriority: priority({
          confirmationRate: 0.92,
          reliabilityScore: 96,
          futureAssignmentCount: 1
        })
      },
      {
        name: "Ada",
        replacementPriority: priority({
          confirmationRate: 0.92,
          reliabilityScore: 96,
          futureAssignmentCount: 1
        })
      }
    ]);

    expect(ranked.map((candidate) => candidate.name)).toEqual([
      "Ada",
      "Bea",
      "Ana",
      "Zoe"
    ]);
  });
});
