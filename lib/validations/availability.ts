import { z } from "zod";

import { DAYS_OF_WEEK, TIME_SLOTS } from "@/lib/constants/domain";

export const availabilityItemSchema = z.object({
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  timeSlot: z.enum(TIME_SLOTS),
  areaPreference: z.string().optional(),
  available: z.boolean().default(true),
  recurring: z.boolean().default(true)
});

export const availabilityExceptionSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().max(250).optional()
});

export const updateAvailabilitySchema = z.object({
  volunteerId: z.string().min(1).optional(),
  items: z.array(availabilityItemSchema),
  temporaryUnavailable: z.boolean().default(false),
  exceptions: z.array(availabilityExceptionSchema).optional()
});
