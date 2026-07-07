import { describe, expect, it } from "vitest";

import { updateSettingsSchema } from "@/lib/validations/settings";

const validSettings = {
  confirmationLeadDays: 8,
  reminderTimingDays: [5, 1],
  finalReminderHours: 3,
  primaryResponseTimeoutHours: 48,
  primaryReminderOffsetsHours: [12, 24, 40],
  replacementResponseTimeoutHours: 12,
  replacementReminderOffsetsHours: [4, 8],
  censusResponseTimeoutHours: 72,
  censusReminderOffsetsHours: [24, 48],
  urgentThresholdHours: 72,
  autoPrepareNextWeekEnabled: false,
  autoPrepareWeeksAhead: 1,
  adminAlertEmail: "admin@ppam.local",
  notificationChannels: ["EMAIL"]
};

describe("settings validation", () => {
  it("accepts the default automation settings", () => {
    expect(updateSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it("rejects reminder offsets greater than or equal to their timeout", () => {
    const result = updateSettingsSchema.safeParse({
      ...validSettings,
      replacementResponseTimeoutHours: 8,
      replacementReminderOffsetsHours: [4, 8]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty(
        "replacementReminderOffsetsHours"
      );
    }
  });

  it("rejects invalid admin alert emails", () => {
    const result = updateSettingsSchema.safeParse({
      ...validSettings,
      adminAlertEmail: "admin-local"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty(
        "adminAlertEmail"
      );
    }
  });
});
