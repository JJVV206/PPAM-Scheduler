import { describe, expect, it } from "vitest";

import {
  assignmentPreflightSchema,
  createAssignmentSchema
} from "@/lib/validations/assignment";

const baseAssignmentPayload = {
  scheduleWeekId: "week-1",
  date: "2026-07-13T12:00:00.000Z",
  dayOfWeek: "MONDAY",
  timeSlot: "SLOT_09_11",
  preachingPointId: "point-1",
  volunteers: [
    { volunteerId: "volunteer-1", slotNumber: 1 },
    { volunteerId: "volunteer-2", slotNumber: 2 },
    { volunteerId: "volunteer-3", slotNumber: 3 }
  ]
} as const;

describe("assignment validation", () => {
  it("accepts more than two assigned volunteers", () => {
    expect(
      createAssignmentSchema.parse(baseAssignmentPayload).volunteers
    ).toHaveLength(3);
  });

  it("rejects duplicated volunteers", () => {
    const result = createAssignmentSchema.safeParse({
      ...baseAssignmentPayload,
      volunteers: [
        { volunteerId: "volunteer-1", slotNumber: 1 },
        { volunteerId: "volunteer-1", slotNumber: 2 }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicated slot numbers", () => {
    const result = createAssignmentSchema.safeParse({
      ...baseAssignmentPayload,
      volunteers: [
        { volunteerId: "volunteer-1", slotNumber: 1 },
        { volunteerId: "volunteer-2", slotNumber: 1 }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicated preflight volunteers", () => {
    const result = assignmentPreflightSchema.safeParse({
      date: "2026-07-13T12:00:00.000Z",
      timeSlot: "SLOT_09_11",
      volunteerIds: ["volunteer-1", "volunteer-1"]
    });

    expect(result.success).toBe(false);
  });
});
