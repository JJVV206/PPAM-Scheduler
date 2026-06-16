import { describe, expect, it } from "vitest";

import { selectReplacementAssignmentPosition } from "@/services/assignment.service";

describe("selectReplacementAssignmentPosition", () => {
  it("uses the declined volunteer position first", () => {
    expect(
      selectReplacementAssignmentPosition({
        volunteers: [
          { volunteerId: "volunteer-1", position: "FIRST" },
          { volunteerId: "volunteer-2", position: "SECOND" }
        ],
        responses: [
          { volunteerId: "volunteer-1", responseStatus: "CONFIRMED" },
          { volunteerId: "volunteer-2", responseStatus: "DECLINED" }
        ]
      })
    ).toBe("SECOND");
  });

  it("falls back to the missing position when no volunteer declined", () => {
    expect(
      selectReplacementAssignmentPosition({
        volunteers: [{ volunteerId: "volunteer-1", position: "FIRST" }],
        responses: [{ volunteerId: "volunteer-1", responseStatus: "CONFIRMED" }]
      })
    ).toBe("SECOND");
  });
});
