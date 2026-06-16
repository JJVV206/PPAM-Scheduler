import { describe, expect, it } from "vitest";

import {
  buildAssignmentStartDate,
  getDueConfirmedAssignmentReminder,
  getDuePendingConfirmationReminder,
  normalizeReminderTimingDays,
  notifyAdminsForUnresolvedAssignments,
} from "@/services/assignment-automation.service";

describe("assignment automation deferred steps", () => {
  it("returns explicit skipped results for module-scoped future admin alerts", async () => {
    await expect(notifyAdminsForUnresolvedAssignments()).resolves.toMatchObject({
      status: "skipped",
      processedCount: 0
    });
  });
});

describe("assignment reminder scheduling", () => {
  it("normalizes reminder timing days into a positive ascending cadence", () => {
    expect(normalizeReminderTimingDays([1, 5, 1, 0, -2])).toEqual([1, 5]);
  });

  it("combines assignment date with the time slot start", () => {
    expect(
      buildAssignmentStartDate({
        date: new Date(2026, 5, 20),
        timeSlot: "SLOT_11_13"
      }).getHours()
    ).toBe(11);
  });

  it("selects the five-day reminder once it is due", () => {
    const reminder = getDueConfirmedAssignmentReminder({
      assignmentDate: new Date(2026, 5, 20),
      timeSlot: "SLOT_11_13",
      now: new Date(2026, 5, 15, 11, 0, 0),
      reminderTimingDays: [5, 1],
      finalReminderHours: 3
    });

    expect(reminder).toMatchObject({
      kind: "DAYS_BEFORE",
      reminderKey: "confirmed-5d",
      notificationType: "REMINDER",
      offsetDays: 5
    });
  });

  it("prioritizes the final hours reminder over day reminders", () => {
    const reminder = getDueConfirmedAssignmentReminder({
      assignmentDate: new Date(2026, 5, 20),
      timeSlot: "SLOT_11_13",
      now: new Date(2026, 5, 20, 8, 30, 0),
      reminderTimingDays: [5, 1],
      finalReminderHours: 3
    });

    expect(reminder).toMatchObject({
      kind: "FINAL_HOURS",
      reminderKey: "confirmed-final-3h",
      notificationType: "FINAL_REMINDER",
      offsetHours: 3
    });
  });

  it("schedules pending confirmation reminders before invitation expiration", () => {
    const reminder = getDuePendingConfirmationReminder({
      invitationId: "invitation-1",
      expiresAt: new Date("2026-06-16T18:00:00.000Z"),
      now: new Date("2026-06-16T15:30:00.000Z"),
      finalReminderHours: 3
    });

    expect(reminder).toMatchObject({
      kind: "PENDING_CONFIRMATION",
      reminderKey: "pending-confirmation-invitation-1",
      notificationType: "REMINDER",
      offsetHours: 3
    });
  });
});
