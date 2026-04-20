import { z } from "zod";

import { DAYS_OF_WEEK, TIME_SLOTS } from "@/lib/constants/domain";

export const preachingPointActiveSlotSchema = z.object({
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  timeSlot: z.enum(TIME_SLOTS)
});

export const createPreachingPointSchema = z.object({
  name: z.string().min(2),
  area: z.string().min(2),
  notes: z.string().max(1000).optional(),
  active: z.boolean().default(true),
  activeSlots: z.array(preachingPointActiveSlotSchema).default([])
});

export const updatePreachingPointSchema = createPreachingPointSchema.partial();
