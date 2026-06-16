import nodemailer from "nodemailer";
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma
} from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { getAppBaseUrl, getSmtpConfig } from "@/lib/env/config";
import { humanizeErrorMessage } from "@/lib/utils/error-message";
import { safeJsonMetadata } from "@/lib/utils/safe-metadata";
import { AppError } from "@/services/errors";
import { buildAssignmentReminderEmail } from "@/services/email-template.service";

type NotificationPayload = {
  userId: string;
  assignmentId?: string;
  type: NotificationType;
  channel?: NotificationChannel;
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, unknown>;
};

export function sanitizeNotificationMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  return safeJsonMetadata(metadata) as Record<string, unknown> | undefined;
}

function createTransport() {
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth
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
      metadata: sanitizeNotificationMetadata(payload.metadata) as
        | Prisma.InputJsonValue
        | undefined
    }
  });
}

export async function sendEmailNotification(payload: NotificationPayload) {
  const user = await db.user.findUnique({ where: { id: payload.userId } });

  if (!user?.email) {
    return logNotification({
      userId: payload.userId,
      assignmentId: payload.assignmentId,
      type: payload.type,
      channel: payload.channel ?? "EMAIL",
      status: "FAILED",
      errorMessage: "No se encontró un correo para el destinatario",
      metadata: payload.metadata
    });
  }

  try {
    const smtpConfig = getSmtpConfig();
    const transport = smtpConfig ? createTransport() : null;

    if (!transport) {
      console.info("Email notification", {
        to: user.email,
        subject: payload.subject,
        type: payload.type
      });

      return logNotification({
        userId: payload.userId,
        assignmentId: payload.assignmentId,
        type: payload.type,
        channel: payload.channel ?? "EMAIL",
        status: "SENT",
        metadata: {
          ...payload.metadata,
          simulated: true
        }
      });
    } else {
      await transport.sendMail({
        from: smtpConfig?.from,
        to: user.email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text
      });
    }

    return logNotification({
      userId: payload.userId,
      assignmentId: payload.assignmentId,
      type: payload.type,
      channel: payload.channel ?? "EMAIL",
      status: "SENT",
      metadata: payload.metadata
    });
  } catch (error) {
    const technicalMessage =
      error instanceof Error
        ? error.message
        : "Error desconocido al enviar la notificación";
    const userMessage = humanizeErrorMessage(
      technicalMessage,
      "No fue posible enviar la notificación."
    );

    await logNotification({
      userId: payload.userId,
      assignmentId: payload.assignmentId,
      type: payload.type,
      channel: payload.channel ?? "EMAIL",
      status: "FAILED",
      errorMessage: userMessage,
      metadata: payload.metadata
    });

    throw new AppError(userMessage, 500);
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
  const responseUrl =
    input.confirmationLink ??
    `${getAppBaseUrl()}/volunteer/assignments/${encodeURIComponent(
      input.assignmentId
    )}`;
  const email = buildAssignmentReminderEmail({
    kind: "PENDING_CONFIRMATION",
    volunteerName: input.volunteerName,
    pointName: input.pointName,
    dateLabel: input.dateLabel,
    timeSlotLabel: input.timeSlotLabel,
    responseUrl
  });

  return sendEmailNotification({
    userId: input.volunteerUserId,
    assignmentId: input.assignmentId,
    type: "REMINDER",
    subject: email.subject,
    html: email.html,
    text: email.text,
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
