import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SettingsDto } from "@/types/domain";

const mocks = vi.hoisted(() => {
  const tx = {
    appSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    appSetting: {
      findUnique: vi.fn()
    }
  };

  return {
    db,
    tx
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import { getAppSettings, updateSettings } from "@/services/setting.service";

const defaultSettings: SettingsDto = {
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.appSetting.findUnique.mockResolvedValue(null);
  mocks.tx.appSetting.findUnique.mockResolvedValue(null);
  mocks.tx.appSetting.upsert.mockResolvedValue({});
});

describe("settings service", () => {
  it("returns complete defaults when settings are missing", async () => {
    await expect(getAppSettings()).resolves.toEqual(defaultSettings);
  });

  it("versions changed settings with the actor user", async () => {
    await updateSettings(
      {
        ...defaultSettings,
        primaryResponseTimeoutHours: 36
      },
      {
        actorUserId: "admin-1"
      }
    );

    const historyCall = mocks.tx.appSetting.upsert.mock.calls
      .map(([call]) => call)
      .find((call) => call.where.key === "settingsChangeHistory");

    expect(historyCall).toBeDefined();
    expect(historyCall?.create.value[0]).toMatchObject({
      version: 1,
      actorUserId: "admin-1",
      changedKeys: ["primaryResponseTimeoutHours"],
      next: expect.objectContaining({
        primaryResponseTimeoutHours: 36
      })
    });
  });
});
