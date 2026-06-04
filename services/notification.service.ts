import nodemailer from "nodemailer";
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma
} from "@prisma/client";

import { db } from "@/lib/db/prisma";

type NotificationPayload = {
  userId: string;
  assignmentId?: string;
  type: NotificationType;
  channel?: NotificationChannel;
  subject: string;
  html: string;
  metadata?: Record<string, unknown>;
};

function createTransport() {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
  });
}

export async function logNotification(payload: {
  userId: string;
  assignmentId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  return db.notificationLog.create({
    data: {
      userId: payload.userId,
      assignmentId: payload.assignmentId,
      type: payload.type,
      channel: payload.channel,
      status: payload.status,
      errorMessage: payload.errorMessage,
      sentAt: payload.status === "SENT" ? new Date() : null,
      metadata: payload.metadata as Prisma.InputJsonValue | undefined
    }
  });
}

export async function sendEmailNotification(payload: NotificationPayload) {
  const user = await db.user.findUnique({ where: { id: payload.userId } });

  if (!user?.email) {
    await logNotification({
      userId: payload.userId,
      assignmentId: payload.assignmentId,
      type: payload.type,
      channel: payload.channel ?? "EMAIL",
      status: "FAILED",
      errorMessage: "No se encontró un correo para el destinatario",
      metadata: payload.metadata
    });
    return;
  }

  const transport = createTransport();

  try {
    if (!transport || process.env.NODE_ENV === "development") {
      console.info("Email notification", {
        to: user.email,
        subject: payload.subject,
        type: payload.type
      });
    } else {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: payload.subject,
        html: payload.html
      });
    }

    await logNotification({
      userId: payload.userId,
      assignmentId: payload.assignmentId,
      type: payload.type,
      channel: payload.channel ?? "EMAIL",
      status: "SENT",
      metadata: payload.metadata
    });
  } catch (error) {
    await logNotification({
      userId: payload.userId,
      assignmentId: payload.assignmentId,
      type: payload.type,
      channel: payload.channel ?? "EMAIL",
      status: "FAILED",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Error desconocido al enviar la notificación",
      metadata: payload.metadata
    });
  }
}

export async function resendConfirmationReminder(input: {
  assignmentId: string;
  volunteerUserId: string;
  volunteerName: string;
  pointName: string;
  dateLabel: string;
  timeSlotLabel: string;
  confirmationLink?: string | null;
}) {
  return sendEmailNotification({
    userId: input.volunteerUserId,
    assignmentId: input.assignmentId,
    type: "REMINDER",
    subject: "Recordatorio: confirma tu asignación de PPAM",
    html: `<p>Hola ${input.volunteerName},</p><p>Confirma tu asignación de PPAM para ${input.dateLabel} a las ${input.timeSlotLabel} en ${input.pointName}.</p>${input.confirmationLink ? `<p><a href="${input.confirmationLink}">Abrir confirmación directa</a></p>` : ""}`,
    metadata: {
      pointName: input.pointName,
      confirmationLink: input.confirmationLink
    }
  });
}

export async function selectAssignmentsNeedingReminders() {
  // Future queue or cron workers can call this selector and dispatch reminders.
  return db.assignment.findMany({
    where: {
      status: "PENDING_CONFIRMATION"
    },
    include: {
      preachingPoint: true,
      volunteers: {
        include: {
          volunteer: {
            include: { user: true }
          }
        }
      },
      responses: true
    }
  });
}
