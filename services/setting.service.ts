import { db } from "@/lib/db/prisma";
import {
  DEFAULT_CENSUS_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_CONFIRMATION_LEAD_DAYS,
  DEFAULT_FINAL_REMINDER_HOURS,
  DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS,
  DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_REMINDER_TIMING_DAYS,
  DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_PRIMARY_REMINDER_OFFSETS_HOURS,
  DEFAULT_URGENT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_THRESHOLD_HOURS
} from "@/lib/constants/app";
import type { SettingsDto } from "@/types/domain";

export type AssignmentAutomationSettings = {
  reminderTimingDays: number[];
  finalReminderHours: number;
  primaryResponseTimeoutHours: number;
  primaryReminderOffsetsHours: number[];
  urgentPrimaryResponseTimeoutHours: number;
  urgentPrimaryReminderOffsetsHours: number[];
  urgentThresholdHours: number;
  replacementResponseTimeoutHours: number;
  censusResponseTimeoutHours: number;
  notificationChannels: SettingsDto["notificationChannels"];
};

export async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const setting = await db.appSetting.findUnique({ where: { key } });
  if (!setting) return fallback;
  return setting.value as T;
}

export async function getAppSettings(): Promise<SettingsDto> {
  const [confirmationLeadDays, reminderTimingDays, notificationChannels] =
    await Promise.all([
      getSettingValue("confirmationLeadDays", DEFAULT_CONFIRMATION_LEAD_DAYS),
      getSettingValue<number[]>(
        "reminderTimingDays",
        [...DEFAULT_REMINDER_TIMING_DAYS]
      ),
      getSettingValue<SettingsDto["notificationChannels"]>("notificationChannels", [
        "EMAIL"
      ])
    ]);

  return {
    confirmationLeadDays,
    reminderTimingDays,
    notificationChannels
  };
}

export async function getAssignmentAutomationSettings(): Promise<AssignmentAutomationSettings> {
  const appSettings = await getAppSettings();
  const [
    finalReminderHours,
    primaryResponseTimeoutHours,
    primaryReminderOffsetsHours,
    urgentPrimaryResponseTimeoutHours,
    urgentPrimaryReminderOffsetsHours,
    urgentThresholdHours,
    replacementResponseTimeoutHours,
    censusResponseTimeoutHours
  ] = await Promise.all([
    getSettingValue("finalReminderHours", DEFAULT_FINAL_REMINDER_HOURS),
    getSettingValue(
      "primaryResponseTimeoutHours",
      DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS
    ),
    getSettingValue<number[]>(
      "primaryReminderOffsetsHours",
      [...DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS]
    ),
    getSettingValue(
      "urgentPrimaryResponseTimeoutHours",
      DEFAULT_URGENT_PRIMARY_RESPONSE_TIMEOUT_HOURS
    ),
    getSettingValue<number[]>(
      "urgentPrimaryReminderOffsetsHours",
      [...DEFAULT_URGENT_PRIMARY_REMINDER_OFFSETS_HOURS]
    ),
    getSettingValue("urgentThresholdHours", DEFAULT_URGENT_THRESHOLD_HOURS),
    getSettingValue(
      "replacementResponseTimeoutHours",
      DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS
    ),
    getSettingValue(
      "censusResponseTimeoutHours",
      DEFAULT_CENSUS_RESPONSE_TIMEOUT_HOURS
    )
  ]);

  return {
    reminderTimingDays: appSettings.reminderTimingDays,
    finalReminderHours,
    primaryResponseTimeoutHours,
    primaryReminderOffsetsHours,
    urgentPrimaryResponseTimeoutHours,
    urgentPrimaryReminderOffsetsHours,
    urgentThresholdHours,
    replacementResponseTimeoutHours,
    censusResponseTimeoutHours,
    notificationChannels: appSettings.notificationChannels
  };
}

export async function updateSettings(input: SettingsDto) {
  const entries = Object.entries(input);

  await db.$transaction(
    entries.map(([key, value]) =>
      db.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    )
  );

  return getAppSettings();
}
