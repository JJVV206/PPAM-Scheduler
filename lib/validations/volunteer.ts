import { z } from "zod";

import { USER_ROLES } from "@/lib/constants/domain";

export const createVolunteerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(USER_ROLES).default("VOLUNTEER"),
  notes: z.string().max(1000).optional(),
  transportationNotes: z.string().max(500).optional(),
  preferredAreas: z.array(z.string()).default([]),
  active: z.boolean().default(true)
});

export const updateVolunteerSchema = createVolunteerSchema.partial().extend({
  temporaryUnavailable: z.boolean().optional()
});
