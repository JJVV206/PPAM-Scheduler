import { db } from "@/lib/db/prisma";
import { DEFAULT_CONFIRMATION_LEAD_DAYS } from "@/lib/constants/app";
import type { SettingsDto } from "@/types/domain";

export async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const setting = await db.appSetting.findUnique({ where: { key } });
  if (!setting) return fallback;
  return setting.value as T;
}

export async function getAppSettings(): Promise<SettingsDto> {
  const [confirmationLeadDays, reminderTimingDays, notificationChannels] =
    await Promise.all([
      getSettingValue("confirmationLeadDays", DEFAULT_CONFIRMATION_LEAD_DAYS),
      getSettingValue<number[]>("reminderTimingDays", [8, 3, 1]),
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
