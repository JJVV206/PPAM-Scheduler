import { z } from "zod";

import { NOTIFICATION_CHANNELS } from "@/lib/constants/domain";

const dayValueSchema = z.number().int().min(1).max(30);
const hourValueSchema = z.number().int().min(1).max(24 * 30);
const reminderOffsetsSchema = z.array(hourValueSchema).min(1);

function addOffsetTimeoutIssue(
  ctx: z.RefinementCtx,
  input: {
    offsets: number[];
    timeout: number;
    path: string;
    label: string;
  }
) {
  const invalidOffset = input.offsets.find((offset) => offset >= input.timeout);

  if (!invalidOffset) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [input.path],
    message: `${input.label} deben ser menores que el tiempo de respuesta.`
  });
}

export const updateSettingsSchema = z
  .object({
    confirmationLeadDays: dayValueSchema,
    reminderTimingDays: z.array(dayValueSchema).min(1),
    finalReminderHours: hourValueSchema,
    primaryResponseTimeoutHours: hourValueSchema,
    primaryReminderOffsetsHours: reminderOffsetsSchema,
    replacementResponseTimeoutHours: hourValueSchema,
    replacementReminderOffsetsHours: reminderOffsetsSchema,
    censusResponseTimeoutHours: hourValueSchema,
    censusReminderOffsetsHours: reminderOffsetsSchema,
    urgentThresholdHours: hourValueSchema,
    adminAlertEmail: z.string().trim().email(),
    notificationChannels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1)
  })
  .superRefine((settings, ctx) => {
    addOffsetTimeoutIssue(ctx, {
      offsets: settings.primaryReminderOffsetsHours,
      timeout: settings.primaryResponseTimeoutHours,
      path: "primaryReminderOffsetsHours",
      label: "Los recordatorios del titular"
    });
    addOffsetTimeoutIssue(ctx, {
      offsets: settings.replacementReminderOffsetsHours,
      timeout: settings.replacementResponseTimeoutHours,
      path: "replacementReminderOffsetsHours",
      label: "Los recordatorios del suplente"
    });
    addOffsetTimeoutIssue(ctx, {
      offsets: settings.censusReminderOffsetsHours,
      timeout: settings.censusResponseTimeoutHours,
      path: "censusReminderOffsetsHours",
      label: "Los recordatorios del censo"
    });
  });
