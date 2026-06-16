import { describe, expect, it } from "vitest";

import {
  rankReplacementCandidates,
  type ReplacementCandidatePriority
} from "@/services/replacement-candidate.service";

function priority(
  overrides: Partial<ReplacementCandidatePriority> = {}
): ReplacementCandidatePriority {
  return {
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

describe("rankReplacementCandidates", () => {
  it("prioritizes exact availability and replacement eligibility first", () => {
    const ranked = rankReplacementCandidates([
      {
        name: "B Candidate",
        replacementPriority: priority({ exactAvailability: false })
      },
      {
        name: "A Candidate",
        replacementPriority: priority({ markedAsReplacement: false })
      },
      {
        name: "C Candidate",
        replacementPriority: priority()
      }
    ]);

    expect(ranked.map((candidate) => candidate.name)).toEqual([
      "C Candidate",
      "A Candidate",
      "B Candidate"
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
