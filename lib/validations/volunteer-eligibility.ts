import { z } from "zod";

import { TIME_SLOTS } from "@/lib/constants/domain";

export const eligibleVolunteersQuerySchema = z.object({
  date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  timeSlot: z.enum(TIME_SLOTS),
  assignmentId: z.string().min(1).optional()
});
