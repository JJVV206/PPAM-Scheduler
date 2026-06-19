import { z } from "zod";

import { USER_ROLES } from "@/lib/constants/domain";

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES)
});

export const reviewUserAdmissionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z
    .string()
    .trim()
    .max(500, "La nota no puede superar 500 caracteres.")
    .optional()
});
