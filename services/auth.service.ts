import { addHours, isAfter } from "date-fns";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { getAppBaseUrl } from "@/lib/env/config";
import { AppError } from "@/services/errors";
import { sendEmailNotification } from "@/services/notification.service";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function registerAccount(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim();
  const existingUser = await db.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    throw new AppError("Ya existe una cuenta registrada con ese correo.", 409);
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          role: "VOLUNTEER",
          active: false,
          accessStatus: "PENDING_APPROVAL",
          volunteerProfile: {
            create: {
              preferredAreas: [],
              active: false,
              temporaryUnavailable: true,
              canServeAsReplacement: false
            }
          }
        },
        include: {
          volunteerProfile: true
        }
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: user.active,
        accessStatus: user.accessStatus,
        volunteerProfileId: user.volunteerProfile?.id ?? null
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("Ya existe una cuenta registrada con ese correo.", 409);
    }

    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("hex");
  const resetUrl = `${getAppBaseUrl()}/reset-password/${token}`;

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
    html: `<p>Hola ${user.name},</p><p>Usa este enlace para restablecer tu contraseña:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    metadata: {
      resetRequestedAt: new Date().toISOString()
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
