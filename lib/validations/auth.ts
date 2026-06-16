import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.")
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Ingresa tu nombre.")
      .max(120, "El nombre no puede superar 120 caracteres."),
    email: z.string().trim().email("Ingresa un correo válido."),
    phone: z
      .string()
      .trim()
      .max(30, "El teléfono no puede superar 30 caracteres.")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .regex(/[A-Z]/, "La contraseña debe incluir una letra mayúscula.")
      .regex(/[a-z]/, "La contraseña debe incluir una letra minúscula.")
      .regex(/[0-9]/, "La contraseña debe incluir un número."),
    confirmPassword: z.string().min(1, "Confirma tu contraseña.")
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Las contraseñas no coinciden.",
        path: ["confirmPassword"]
      });
    }
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Ingresa un correo válido.")
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "El token de restablecimiento no es válido."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .regex(/[A-Z]/, "La contraseña debe incluir una letra mayúscula.")
    .regex(/[a-z]/, "La contraseña debe incluir una letra minúscula.")
    .regex(/[0-9]/, "La contraseña debe incluir un número.")
});
