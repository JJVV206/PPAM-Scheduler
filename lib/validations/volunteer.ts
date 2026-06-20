import { z } from "zod";

import { USER_ROLES } from "@/lib/constants/domain";
import { hasVolunteerServiceCapacity } from "@/lib/volunteer-service-type";

const volunteerCapabilityMessage =
  "Selecciona al menos una capacidad operativa.";

function validateVolunteerCapabilities(
  values: {
    role?: (typeof USER_ROLES)[number];
    active?: boolean;
    canServeAsPrimary?: boolean;
    canServeAsReplacement?: boolean;
  },
  context: z.RefinementCtx
) {
  if (values.role === "ADMIN" || values.active === false) return;
  if (
    hasVolunteerServiceCapacity({
      canServeAsPrimary: values.canServeAsPrimary ?? true,
      canServeAsReplacement: values.canServeAsReplacement ?? false
    })
  ) {
    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: volunteerCapabilityMessage,
    path: ["canServeAsPrimary"]
  });
}

const volunteerBaseSchema = z.object({
  name: z.string().min(2, "Ingresa al menos 2 caracteres."),
  email: z.string().email("Ingresa un correo válido."),
  phone: z
    .string()
    .trim()
    .min(7, "Ingresa un celular válido.")
    .max(30, "El teléfono no puede superar 30 caracteres.")
    .regex(
      /^[+()\d\s-]+$/,
      "El celular solo puede incluir números, espacios, guiones, paréntesis y +."
    ),
  role: z.enum(USER_ROLES).default("VOLUNTEER"),
  notes: z.string().max(1000, "No excedas 1000 caracteres.").optional(),
  transportationNotes: z
    .string()
    .max(500, "No excedas 500 caracteres.")
    .optional(),
  preferredAreas: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  canServeAsPrimary: z.boolean().default(true),
  canServeAsReplacement: z.boolean().default(false)
});

export const createVolunteerSchema = volunteerBaseSchema.superRefine(
  validateVolunteerCapabilities
);

export const updateVolunteerSchema = volunteerBaseSchema
  .partial()
  .extend({
    temporaryUnavailable: z.boolean().optional()
  })
  .superRefine(validateVolunteerCapabilities);
