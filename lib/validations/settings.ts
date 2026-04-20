import { z } from "zod";

import { NOTIFICATION_CHANNELS } from "@/lib/constants/domain";

export const updateSettingsSchema = z.object({
  confirmationLeadDays: z.number().int().min(1).max(30),
  reminderTimingDays: z.array(z.number().int().min(0).max(30)),
  notificationChannels: z.array(z.enum(NOTIFICATION_CHANNELS))
});
