import { describe, expect, it } from "vitest";

import { selectReplacementAssignmentSlotNumber } from "@/services/assignment.service";

describe("selectReplacementAssignmentSlotNumber", () => {
  it("uses the declined volunteer slot first", () => {
    expect(
      selectReplacementAssignmentSlotNumber({
        volunteers: [
          { volunteerId: "volunteer-1", slotNumber: 1 },
          { volunteerId: "volunteer-2", slotNumber: 2 }
        ],
        responses: [
          { volunteerId: "volunteer-1", responseStatus: "CONFIRMED" },
          { volunteerId: "volunteer-2", responseStatus: "DECLINED" }
        ]
      })
    ).toBe(2);
  });

  it("falls back to the missing base slot when no volunteer declined", () => {
    expect(
      selectReplacementAssignmentSlotNumber({
        volunteers: [{ volunteerId: "volunteer-1", slotNumber: 1 }],
        responses: [{ volunteerId: "volunteer-1", responseStatus: "CONFIRMED" }]
      })
    ).toBe(2);
  });
});
