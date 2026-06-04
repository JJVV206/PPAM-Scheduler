import { addHours, isAfter } from "date-fns";
import { randomBytes } from "crypto";

import { db } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/services/errors";
import { sendEmailNotification } from "@/services/notification.service";

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("hex");

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: addHours(new Date(), 3)
    }
  });

  await sendEmailNotification({
    userId: user.id,
    type: "RESET_PASSWORD",
    subject: "Restablece tu contraseña de PPAM Planificador",
    html: `<p>Hola ${user.name},</p><p>Usa este enlace para restablecer tu contraseña:</p><p><a href="${process.env.NEXTAUTH_URL}/reset-password/${token}">${process.env.NEXTAUTH_URL}/reset-password/${token}</a></p>`,
    metadata: {
      token
    }
  });
}

export async function resetPassword(token: string, password: string) {
  const resetToken = await db.passwordResetToken.findUnique({
    where: { token }
  });

  if (!resetToken || resetToken.usedAt || isAfter(new Date(), resetToken.expiresAt)) {
    throw new AppError("Este token de restablecimiento no es válido o ya expiró.", 400);
  }

  const passwordHash = await hashPassword(password);

  await db.$transaction([
    db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    }),
    db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    })
  ]);
}

export async function getPasswordResetTokenState(token: string) {
  const resetToken = await db.passwordResetToken.findUnique({
    where: { token }
  });

  return {
    valid:
      !!resetToken &&
      !resetToken.usedAt &&
      !isAfter(new Date(), resetToken.expiresAt)
  };
}
