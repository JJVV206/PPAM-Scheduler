import { describe, expect, it } from "vitest";

import { determineAssignmentStatus } from "@/services/assignment-engine";

describe("determineAssignmentStatus", () => {
  it("returns needs replacement when the pair is incomplete", () => {
    const status = determineAssignmentStatus({
      assignmentDate: new Date("2026-05-10T09:00:00.000Z"),
      volunteerCount: 1,
      responses: [{ responseStatus: "PENDING" }],
      confirmationLeadDays: 8,
      now: new Date("2026-04-19T09:00:00.000Z")
    });

    expect(status).toBe("NEEDS_REPLACEMENT");
  });

  it("returns scheduled before the confirmation window when the pair is complete", () => {
    const status = determineAssignmentStatus({
      assignmentDate: new Date("2026-05-10T09:00:00.000Z"),
      volunteerCount: 2,
      responses: [{ responseStatus: "PENDING" }, { responseStatus: "PENDING" }],
      confirmationLeadDays: 8,
      now: new Date("2026-04-19T09:00:00.000Z")
    });

    expect(status).toBe("SCHEDULED");
  });

  it("returns pending confirmation inside the lead window when responses are still pending", () => {
    const status = determineAssignmentStatus({
      assignmentDate: new Date("2026-04-25T09:00:00.000Z"),
      volunteerCount: 2,
      responses: [
        { responseStatus: "CONFIRMED" },
        { responseStatus: "PENDING" }
      ],
      confirmationLeadDays: 8,
      now: new Date("2026-04-19T09:00:00.000Z")
    });

    expect(status).toBe("PENDING_CONFIRMATION");
  });

  it("returns needs replacement when a volunteer declines", () => {
    const status = determineAssignmentStatus({
      assignmentDate: new Date("2026-04-25T09:00:00.000Z"),
      volunteerCount: 2,
      responses: [
        { responseStatus: "DECLINED" },
        { responseStatus: "PENDING" }
      ],
      confirmationLeadDays: 8,
      now: new Date("2026-04-19T09:00:00.000Z")
    });

    expect(status).toBe("NEEDS_REPLACEMENT");
  });

  it("returns confirmed when both volunteers confirm", () => {
    const status = determineAssignmentStatus({
      assignmentDate: new Date("2026-04-25T09:00:00.000Z"),
      volunteerCount: 2,
      responses: [
        { responseStatus: "CONFIRMED" },
        { responseStatus: "CONFIRMED" }
      ],
      confirmationLeadDays: 8,
      now: new Date("2026-04-19T09:00:00.000Z")
    });

    expect(status).toBe("CONFIRMED");
  });
});
