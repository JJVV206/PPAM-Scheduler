import type { AssignmentInvitationType } from "@prisma/client";

export type EmailTemplate = {
  subject: string;
  html: string;
};

type AssignmentEmailSummaryInput = {
  dateLabel: string;
  timeSlotLabel: string;
  pointName: string;
};

type VolunteerAssignmentEmailInput = AssignmentEmailSummaryInput & {
  volunteerName: string;
};

type ReplacementCensusEmailInput = {
  volunteerName: string;
  weekLabel: string;
  closesAtLabel: string;
  responseUrl: string;
};

export type AssignmentReminderEmailKind =
  | "DAYS_BEFORE"
  | "FINAL_HOURS"
  | "PENDING_CONFIRMATION";

export type AssignmentReminderEmailInput = VolunteerAssignmentEmailInput & {
  kind: AssignmentReminderEmailKind;
  responseUrl: string;
  offsetDays?: number;
  offsetHours?: number;
};

export type AdminAssignmentAlertReason =
  | "NO_REPLACEMENT_AVAILABLE"
  | "INVITATION_EMAIL_FAILED";

export type AdminAssignmentAlertEmailInput = AssignmentEmailSummaryInput & {
  reason: AdminAssignmentAlertReason;
  reasonLabel: string;
  originalVolunteerNames: string[];
  attemptedReplacementNames: string[];
  assignmentUrl: string;
  affectedVolunteerName?: string;
  invitationType?: AssignmentInvitationType;
  errorMessage?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function assignmentSummaryList(input: AssignmentEmailSummaryInput) {
  return [
    "<ul>",
    `<li><strong>Fecha:</strong> ${escapeHtml(input.dateLabel)}</li>`,
    `<li><strong>Horario:</strong> ${escapeHtml(input.timeSlotLabel)}</li>`,
    `<li><strong>Punto de predicación:</strong> ${escapeHtml(
      input.pointName
    )}</li>`,
    "</ul>"
  ].join("");
}

function actionWithFallback(input: {
  href: string;
  label: string;
  fallbackLabel?: string;
}) {
  const href = escapeHtml(input.href);

  return [
    `<p><a href="${href}">${escapeHtml(input.label)}</a></p>`,
    `<p>${escapeHtml(
      input.fallbackLabel ??
        "Si el botón no funciona, copia y pega esta URL en tu navegador:"
    )}<br>${href}</p>`
  ].join("");
}

function formatNameList(names: string[], fallback = "No registrado") {
  return names.length ? names.join(", ") : fallback;
}

function getInvitationTypeLabel(invitationType?: AssignmentInvitationType) {
  if (!invitationType) {
    return undefined;
  }

  return invitationType === "REPLACEMENT" ? "Suplente" : "Titular";
}

export function buildPrimaryAssignmentInvitationEmail(
  input: VolunteerAssignmentEmailInput & {
    responseUrl: string;
  }
): EmailTemplate {
  return {
    subject: "Confirma tu asignación de PPAM",
    html: [
      `<p>Hola ${escapeHtml(input.volunteerName)},</p>`,
      "<p>Tienes una asignación de PPAM pendiente de confirmación.</p>",
      assignmentSummaryList(input),
      actionWithFallback({
        href: input.responseUrl,
        label: "Confirmar o rechazar asignación"
      })
    ].join("")
  };
}

export function buildReplacementAssignmentInvitationEmail(
  input: VolunteerAssignmentEmailInput & {
    responseUrl: string;
  }
): EmailTemplate {
  return {
    subject: "Oportunidad de reemplazo PPAM",
    html: [
      `<p>Hola ${escapeHtml(input.volunteerName)},</p>`,
      "<p>Hay una asignación de PPAM que necesita suplente.</p>",
      assignmentSummaryList(input),
      actionWithFallback({
        href: input.responseUrl,
        label: "Responder si puedes cubrirla"
      })
    ].join("")
  };
}

export function buildReplacementCensusInvitationEmail(
  input: ReplacementCensusEmailInput
): EmailTemplate {
  return {
    subject: "Censo semanal de suplentes PPAM",
    html: [
      `<p>Hola ${escapeHtml(input.volunteerName)},</p>`,
      `<p>Estamos preparando la ${escapeHtml(
        input.weekLabel
      )}. Indica por favor en qué días puedes apoyar como suplente.</p>`,
      "<ul>",
      `<li><strong>Semana:</strong> ${escapeHtml(input.weekLabel)}</li>`,
      `<li><strong>Fecha límite:</strong> ${escapeHtml(
        input.closesAtLabel
      )}</li>`,
      "</ul>",
      actionWithFallback({
        href: input.responseUrl,
        label: "Responder censo semanal"
      })
    ].join("")
  };
}

export function buildAssignmentReminderEmail(
  input: AssignmentReminderEmailInput
): EmailTemplate {
  if (input.kind === "PENDING_CONFIRMATION") {
    return {
      subject: "Pendiente: confirma tu asignación de PPAM",
      html: [
        `<p>Hola ${escapeHtml(input.volunteerName)},</p>`,
        "<p>Tu invitación de PPAM sigue pendiente. Por favor confirma o rechaza antes de que expire.</p>",
        assignmentSummaryList(input),
        actionWithFallback({
          href: input.responseUrl,
          label: "Confirmar o rechazar asignación"
        })
      ].join("")
    };
  }

  if (input.kind === "FINAL_HOURS") {
    const hours = input.offsetHours ?? 0;

    return {
      subject: `Recordatorio final: asignación PPAM en ${hours} horas`,
      html: [
        `<p>Hola ${escapeHtml(input.volunteerName)},</p>`,
        "<p>Este es un recordatorio final de tu asignación confirmada de PPAM.</p>",
        assignmentSummaryList(input),
        actionWithFallback({
          href: input.responseUrl,
          label: "Ver detalle de la asignación"
        })
      ].join("")
    };
  }

  const days = input.offsetDays ?? 0;

  return {
    subject:
      days === 1
        ? "Recordatorio: asignación PPAM mañana"
        : `Recordatorio: asignación PPAM en ${days} días`,
    html: [
      `<p>Hola ${escapeHtml(input.volunteerName)},</p>`,
      "<p>Te recordamos tu próxima asignación confirmada de PPAM.</p>",
      assignmentSummaryList(input),
      actionWithFallback({
        href: input.responseUrl,
        label: "Ver detalle de la asignación"
      })
    ].join("")
  };
}

export function buildAssignmentConfirmationReceivedEmail(
  input: VolunteerAssignmentEmailInput & {
    assignmentUrl: string;
  }
): EmailTemplate {
  return {
    subject: "Confirmación recibida: asignación PPAM",
    html: [
      `<p>Hola ${escapeHtml(input.volunteerName)},</p>`,
      "<p>Recibimos tu confirmación. Gracias por apoyar esta asignación de PPAM.</p>",
      assignmentSummaryList(input),
      actionWithFallback({
        href: input.assignmentUrl,
        label: "Ver detalle de la asignación"
      })
    ].join("")
  };
}

export function buildAdminAssignmentAlertEmail(
  input: AdminAssignmentAlertEmailInput
): EmailTemplate {
  const subject =
    input.reason === "INVITATION_EMAIL_FAILED"
      ? `Urgente: fallo de email para ${input.dateLabel}, ${input.timeSlotLabel}`
      : `Urgente: asignación sin cobertura para ${input.dateLabel}, ${input.timeSlotLabel}`;
  const invitationTypeLabel = getInvitationTypeLabel(input.invitationType);
  const optionalRows = [
    input.affectedVolunteerName
      ? `<li><strong>Voluntario afectado:</strong> ${escapeHtml(
          input.affectedVolunteerName
        )}</li>`
      : "",
    invitationTypeLabel
      ? `<li><strong>Tipo de invitación:</strong> ${escapeHtml(
          invitationTypeLabel
        )}</li>`
      : "",
    input.errorMessage
      ? `<li><strong>Error de email:</strong> ${escapeHtml(
          input.errorMessage
        )}</li>`
      : ""
  ].filter(Boolean);

  return {
    subject,
    html: [
      "<p>Se requiere intervención humana para una asignación de PPAM.</p>",
      "<ul>",
      `<li><strong>Fecha:</strong> ${escapeHtml(input.dateLabel)}</li>`,
      `<li><strong>Horario:</strong> ${escapeHtml(input.timeSlotLabel)}</li>`,
      `<li><strong>Punto:</strong> ${escapeHtml(input.pointName)}</li>`,
      `<li><strong>Titular original:</strong> ${escapeHtml(
        formatNameList(input.originalVolunteerNames)
      )}</li>`,
      `<li><strong>Suplentes intentados:</strong> ${escapeHtml(
        formatNameList(input.attemptedReplacementNames, "Ninguno")
      )}</li>`,
      `<li><strong>Razón:</strong> ${escapeHtml(input.reasonLabel)}</li>`,
      ...optionalRows,
      "</ul>",
      actionWithFallback({
        href: input.assignmentUrl,
        label: "Abrir detalle de la asignación",
        fallbackLabel: "URL directa:"
      })
    ].join("")
  };
}
