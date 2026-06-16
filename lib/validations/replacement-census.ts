import { z } from "zod";

import { DAYS_OF_WEEK, TIME_SLOTS } from "@/lib/constants/domain";

export const replacementCensusAvailabilityDaySchema = z.object({
  date: z.string().datetime(),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  available: z.boolean(),
  timeSlots: z.array(z.enum(TIME_SLOTS)).optional(),
  notes: z
    .string()
    .max(500, "No excedas 500 caracteres.")
    .optional()
});

export const replacementCensusSubmissionSchema = z.object({
  days: z
    .array(replacementCensusAvailabilityDaySchema)
    .length(7, "Debes enviar los 7 días de la semana.")
});
