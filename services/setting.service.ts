import { Prisma } from "@prisma/client";

import { NOTIFICATION_CHANNELS } from "@/lib/constants/domain";
import { db } from "@/lib/db/prisma";
import {
  DEFAULT_ADMIN_ALERT_EMAIL,
  DEFAULT_CENSUS_REMINDER_OFFSETS_HOURS,
  DEFAULT_CENSUS_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_CONFIRMATION_LEAD_DAYS,
  DEFAULT_FINAL_REMINDER_HOURS,
  DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS,
  DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_REMINDER_TIMING_DAYS,
  DEFAULT_REPLACEMENT_REMINDER_OFFSETS_HOURS,
  DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_PRIMARY_REMINDER_OFFSETS_HOURS,
  DEFAULT_URGENT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_REPLACEMENT_REMINDER_OFFSETS_HOURS,
  DEFAULT_URGENT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_THRESHOLD_HOURS
} from "@/lib/constants/app";
import type { SettingsDto } from "@/types/domain";

const ASSIGNMENT_AUTOMATION_LAST_RUN_SETTING_KEY = "assignmentAutomationLastRun";
const SETTINGS_CHANGE_HISTORY_SETTING_KEY = "settingsChangeHistory";
const SETTINGS_CHANGE_HISTORY_LIMIT = 50;

export type AssignmentAutomationSettings = {
  reminderTimingDays: number[];
  finalReminderHours: number;
  primaryResponseTimeoutHours: number;
  primaryReminderOffsetsHours: number[];
  urgentPrimaryResponseTimeoutHours: number;
  urgentPrimaryReminderOffsetsHours: number[];
  urgentThresholdHours: number;
  replacementResponseTimeoutHours: number;
  replacementReminderOffsetsHours: number[];
  urgentReplacementResponseTimeoutHours: number;
  urgentReplacementReminderOffsetsHours: number[];
  censusResponseTimeoutHours: number;
  censusReminderOffsetsHours: number[];
  adminAlertEmail: string;
  notificationChannels: SettingsDto["notificationChannels"];
};

export type AssignmentAutomationLastRunSummary = {
  automationRunId: string;
  status: "completed" | "completed_with_errors";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  failedStepCount: number;
  summarySaved: boolean;
};

export type SettingsChangeHistoryEntry = {
  version: number;
  changedAt: string;
  actorUserId: string | null;
  changedKeys: string[];
  previous: SettingsDto;
  next: SettingsDto;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return isPositiveInteger(value) ? value : fallback;
}

function normalizeNumberList(
  value: unknown,
  fallback: readonly number[],
  options?: {
    sort?: boolean;
  }
): number[] {
  const values = Array.isArray(value) ? value : [];
  const normalized = [
    ...new Set(values.filter((item): item is number => isPositiveInteger(item)))
  ];

  if (options?.sort) {
    normalized.sort((left, right) => left - right);
  }

  return normalized.length ? normalized : [...fallback];
}

function normalizeNotificationChannels(
  value: unknown
): SettingsDto["notificationChannels"] {
  const allowedChannels = new Set<string>(NOTIFICATION_CHANNELS);
  const values = Array.isArray(value) ? value : [];
  const channels = values.filter(
    (channel): channel is SettingsDto["notificationChannels"][number] =>
      typeof channel === "string" && allowedChannels.has(channel)
  );

  return channels.length
    ? ([...new Set(channels)] as SettingsDto["notificationChannels"])
    : (["EMAIL"] as SettingsDto["notificationChannels"]);
}

function normalizeAdminAlertEmail(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_ADMIN_ALERT_EMAIL;
  }

  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : DEFAULT_ADMIN_ALERT_EMAIL;
}

function normalizeSettings(input: SettingsDto): SettingsDto {
  return {
    confirmationLeadDays: normalizePositiveInteger(
      input.confirmationLeadDays,
      DEFAULT_CONFIRMATION_LEAD_DAYS
    ),
    reminderTimingDays: normalizeNumberList(
      input.reminderTimingDays,
      DEFAULT_REMINDER_TIMING_DAYS
    ),
    finalReminderHours: normalizePositiveInteger(
      input.finalReminderHours,
      DEFAULT_FINAL_REMINDER_HOURS
    ),
    primaryResponseTimeoutHours: normalizePositiveInteger(
      input.primaryResponseTimeoutHours,
      DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS
    ),
    primaryReminderOffsetsHours: normalizeNumberList(
      input.primaryReminderOffsetsHours,
      DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS,
      { sort: true }
    ),
    replacementResponseTimeoutHours: normalizePositiveInteger(
      input.replacementResponseTimeoutHours,
      DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS
    ),
    replacementReminderOffsetsHours: normalizeNumberList(
      input.replacementReminderOffsetsHours,
      DEFAULT_REPLACEMENT_REMINDER_OFFSETS_HOURS,
      { sort: true }
    ),
    censusResponseTimeoutHours: normalizePositiveInteger(
      input.censusResponseTimeoutHours,
      DEFAULT_CENSUS_RESPONSE_TIMEOUT_HOURS
    ),
    censusReminderOffsetsHours: normalizeNumberList(
      input.censusReminderOffsetsHours,
      DEFAULT_CENSUS_REMINDER_OFFSETS_HOURS,
      { sort: true }
    ),
    urgentThresholdHours: normalizePositiveInteger(
      input.urgentThresholdHours,
      DEFAULT_URGENT_THRESHOLD_HOURS
    ),
    adminAlertEmail: normalizeAdminAlertEmail(input.adminAlertEmail),
    notificationChannels: normalizeNotificationChannels(input.notificationChannels)
  };
}

function parseSettingsChangeHistory(value: unknown): SettingsChangeHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is SettingsChangeHistoryEntry => {
    const record = asRecord(entry);

    return Boolean(
      record &&
        typeof record.version === "number" &&
        typeof record.changedAt === "string" &&
        Array.isArray(record.changedKeys) &&
        record.changedKeys.every((key) => typeof key === "string")
    );
  });
}

function getChangedSettingKeys(previous: SettingsDto, next: SettingsDto) {
  return (Object.keys(next) as (keyof SettingsDto)[]).filter(
    (key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key])
  );
}

function isAssignmentAutomationLastRunSummary(
  value: unknown
): value is AssignmentAutomationLastRunSummary {
  const record = asRecord(value);

  return Boolean(
    record &&
      typeof record.automationRunId === "string" &&
      (record.status === "completed" ||
        record.status === "completed_with_errors") &&
      typeof record.startedAt === "string" &&
      typeof record.finishedAt === "string" &&
      typeof record.durationMs === "number" &&
      typeof record.failedStepCount === "number" &&
      typeof record.summarySaved === "boolean"
  );
}

export async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const setting = await db.appSetting.findUnique({ where: { key } });
  if (!setting) return fallback;
  return setting.value as T;
}

export async function getAppSettings(): Promise<SettingsDto> {
  const [
    confirmationLeadDays,
    reminderTimingDays,
    finalReminderHours,
    primaryResponseTimeoutHours,
    primaryReminderOffsetsHours,
    replacementResponseTimeoutHours,
    replacementReminderOffsetsHours,
    censusResponseTimeoutHours,
    censusReminderOffsetsHours,
    urgentThresholdHours,
    adminAlertEmail,
    notificationChannels
  ] = await Promise.all([
    getSettingValue("confirmationLeadDays", DEFAULT_CONFIRMATION_LEAD_DAYS),
    getSettingValue<number[]>(
      "reminderTimingDays",
      [...DEFAULT_REMINDER_TIMING_DAYS]
    ),
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
      "replacementResponseTimeoutHours",
      DEFAULT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS
    ),
    getSettingValue<number[]>(
      "replacementReminderOffsetsHours",
      [...DEFAULT_REPLACEMENT_REMINDER_OFFSETS_HOURS]
    ),
    getSettingValue(
      "censusResponseTimeoutHours",
      DEFAULT_CENSUS_RESPONSE_TIMEOUT_HOURS
    ),
    getSettingValue<number[]>(
      "censusReminderOffsetsHours",
      [...DEFAULT_CENSUS_REMINDER_OFFSETS_HOURS]
    ),
    getSettingValue("urgentThresholdHours", DEFAULT_URGENT_THRESHOLD_HOURS),
    getSettingValue("adminAlertEmail", DEFAULT_ADMIN_ALERT_EMAIL),
    getSettingValue<SettingsDto["notificationChannels"]>("notificationChannels", [
      "EMAIL"
    ])
  ]);

  return normalizeSettings({
    confirmationLeadDays,
    reminderTimingDays,
    finalReminderHours,
    primaryResponseTimeoutHours,
    primaryReminderOffsetsHours,
    replacementResponseTimeoutHours,
    replacementReminderOffsetsHours,
    censusResponseTimeoutHours,
    censusReminderOffsetsHours,
    urgentThresholdHours,
    adminAlertEmail,
    notificationChannels
  });
}

export async function getAssignmentAutomationSettings(): Promise<AssignmentAutomationSettings> {
  const appSettings = await getAppSettings();
  const [
    urgentPrimaryResponseTimeoutHours,
    urgentPrimaryReminderOffsetsHours,
    urgentReplacementResponseTimeoutHours,
    urgentReplacementReminderOffsetsHours
  ] = await Promise.all([
    getSettingValue(
      "urgentPrimaryResponseTimeoutHours",
      DEFAULT_URGENT_PRIMARY_RESPONSE_TIMEOUT_HOURS
    ),
    getSettingValue<number[]>(
      "urgentPrimaryReminderOffsetsHours",
      [...DEFAULT_URGENT_PRIMARY_REMINDER_OFFSETS_HOURS]
    ),
    getSettingValue(
      "urgentReplacementResponseTimeoutHours",
      DEFAULT_URGENT_REPLACEMENT_RESPONSE_TIMEOUT_HOURS
    ),
    getSettingValue<number[]>(
      "urgentReplacementReminderOffsetsHours",
      [...DEFAULT_URGENT_REPLACEMENT_REMINDER_OFFSETS_HOURS]
    )
  ]);

  return {
    reminderTimingDays: appSettings.reminderTimingDays,
    finalReminderHours: appSettings.finalReminderHours,
    primaryResponseTimeoutHours: appSettings.primaryResponseTimeoutHours,
    primaryReminderOffsetsHours: appSettings.primaryReminderOffsetsHours,
    urgentPrimaryResponseTimeoutHours,
    urgentPrimaryReminderOffsetsHours,
    urgentThresholdHours: appSettings.urgentThresholdHours,
    replacementResponseTimeoutHours: appSettings.replacementResponseTimeoutHours,
    replacementReminderOffsetsHours: appSettings.replacementReminderOffsetsHours,
    urgentReplacementResponseTimeoutHours,
    urgentReplacementReminderOffsetsHours,
    censusResponseTimeoutHours: appSettings.censusResponseTimeoutHours,
    censusReminderOffsetsHours: appSettings.censusReminderOffsetsHours,
    adminAlertEmail: appSettings.adminAlertEmail,
    notificationChannels: appSettings.notificationChannels
  };
}

export async function getAssignmentAutomationLastRunSummary() {
  const setting = await db.appSetting.findUnique({
    where: {
      key: ASSIGNMENT_AUTOMATION_LAST_RUN_SETTING_KEY
    }
  });

  if (!isAssignmentAutomationLastRunSummary(setting?.value)) {
    return null;
  }

  return setting.value;
}

export async function getSettingsChangeHistory() {
  const setting = await db.appSetting.findUnique({
    where: {
      key: SETTINGS_CHANGE_HISTORY_SETTING_KEY
    }
  });

  return parseSettingsChangeHistory(setting?.value);
}

export async function updateSettings(
  input: SettingsDto,
  options?: {
    actorUserId?: string | null;
  }
) {
  const previousSettings = await getAppSettings();
  const nextSettings = normalizeSettings(input);
  const entries = Object.entries(nextSettings);
  const changedKeys = getChangedSettingKeys(previousSettings, nextSettings);

  await db.$transaction(async (tx) => {
    await Promise.all(
      entries.map(([key, value]) =>
        tx.appSetting.upsert({
          where: { key },
          update: { value: value as Prisma.InputJsonValue },
          create: { key, value: value as Prisma.InputJsonValue }
        })
      )
    );

    if (!changedKeys.length) {
      return;
    }

    const existingHistory = await tx.appSetting.findUnique({
      where: {
        key: SETTINGS_CHANGE_HISTORY_SETTING_KEY
      }
    });
    const history = parseSettingsChangeHistory(existingHistory?.value);
    const lastVersion = history.at(-1)?.version ?? 0;
    const historyEntry: SettingsChangeHistoryEntry = {
      version: lastVersion + 1,
      changedAt: new Date().toISOString(),
      actorUserId: options?.actorUserId ?? null,
      changedKeys,
      previous: previousSettings,
      next: nextSettings
    };
    const nextHistory = [...history, historyEntry].slice(
      -SETTINGS_CHANGE_HISTORY_LIMIT
    );

    await tx.appSetting.upsert({
      where: {
        key: SETTINGS_CHANGE_HISTORY_SETTING_KEY
      },
      update: {
        value: nextHistory as unknown as Prisma.InputJsonValue
      },
      create: {
        key: SETTINGS_CHANGE_HISTORY_SETTING_KEY,
        value: nextHistory as unknown as Prisma.InputJsonValue
      }
    });
  });

  return getAppSettings();
}
