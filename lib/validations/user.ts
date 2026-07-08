import { z } from "zod";

import { USER_ROLES } from "@/lib/constants/domain";

export const accountNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresa al menos 2 caracteres.")
    .max(120, "El nombre no puede superar 120 caracteres.")
});

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

export const updateUserAccessSchema = z.object({
  action: z.enum(["SUSPEND", "REACTIVATE"]),
  note: z
    .string()
    .trim()
    .max(500, "La nota no puede superar 500 caracteres.")
    .optional(),
  canServeAsPrimary: z.boolean().optional(),
  canServeAsReplacement: z.boolean().optional()
});

export const anonymizeUserAccountSchema = z.object({
  confirmationEmail: z
    .string()
    .trim()
    .email("Ingresa el correo actual para confirmar.")
});
