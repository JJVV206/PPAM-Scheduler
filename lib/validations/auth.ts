import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.")
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
