import type { AssignmentInvitationType } from "@prisma/client";

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
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
  invitationType?: AssignmentInvitationType;
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

type EmailSummaryRow = {
  label: string;
  value?: string | null;
};

type BuildActionEmailInput = {
  subject: string;
  greeting?: string;
  intro: string;
  summary: EmailSummaryRow[];
  cta?: {
    label: string;
    url: string;
    fallbackLabel?: string;
  };
  closing?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function getActionFallbackLabel(fallbackLabel?: string) {
  return (
    fallbackLabel ??
    "Si el enlace no funciona, copia y pega esta URL en tu navegador:"
  );
}

function buildActionEmail(input: BuildActionEmailInput): EmailTemplate {
  const visibleRows = input.summary.filter((row) => row.value?.trim());
  const greeting = input.greeting ? normalizeText(input.greeting) : undefined;
  const intro = normalizeText(input.intro);
  const closing =
    input.closing ?? "Gracias por apoyar la organización de PPAM.";
  const html = [
    greeting ? `<p>${escapeHtml(greeting)}</p>` : "",
    `<p>${escapeHtml(intro)}</p>`,
    visibleRows.length
      ? [
          "<ul>",
          ...visibleRows.map(
            (row) =>
              `<li><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(
                row.value ?? ""
              )}</li>`
          ),
          "</ul>"
        ].join("")
      : "",
    input.cta
      ? [
          `<p><a href="${escapeHtml(input.cta.url)}">${escapeHtml(
            input.cta.label
          )}</a></p>`,
          `<p>${escapeHtml(getActionFallbackLabel(input.cta.fallbackLabel))}<br>${escapeHtml(
            input.cta.url
          )}</p>`
        ].join("")
      : "",
    `<p>${escapeHtml(closing)}</p>`
  ].join("");
  const text = [
    greeting,
    intro,
    ...visibleRows.map((row) => `${row.label}: ${row.value}`),
    input.cta ? `${input.cta.label}: ${input.cta.url}` : undefined,
    input.cta
      ? `${getActionFallbackLabel(input.cta.fallbackLabel)} ${input.cta.url}`
      : undefined,
    closing
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return {
    subject: input.subject,
    html,
    text
  };
}

function assignmentSummaryRows(input: AssignmentEmailSummaryInput) {
  return [
    { label: "Fecha", value: input.dateLabel },
    { label: "Horario", value: input.timeSlotLabel },
    { label: "Punto", value: input.pointName }
  ];
}

function censusSummaryRows(input: ReplacementCensusEmailInput) {
  return [
    { label: "Semana", value: input.weekLabel },
    { label: "Fecha límite", value: input.closesAtLabel }
  ];
}

export function buildPrimaryAssignmentInvitationEmail(
  input: VolunteerAssignmentEmailInput & {
    responseUrl: string;
  }
): EmailTemplate {
  return buildActionEmail({
    subject: "Confirma tu asignación titular de PPAM",
    greeting: `Hola ${input.volunteerName},`,
    intro:
      "Tienes una asignación titular de PPAM pendiente de confirmación. Responde si podrás asistir o si necesitas que busquemos suplente.",
    summary: assignmentSummaryRows(input),
    cta: {
      label: "Confirmar o rechazar asignación",
      url: input.responseUrl
    }
  });
}

export function buildReplacementAssignmentInvitationEmail(
  input: VolunteerAssignmentEmailInput & {
    responseUrl: string;
  }
): EmailTemplate {
  return buildActionEmail({
    subject: "Invitación para cubrir como suplente en PPAM",
    greeting: `Hola ${input.volunteerName},`,
    intro:
      "Hay una asignación de PPAM que necesita suplente. Indica si puedes cubrirla para confirmar el turno.",
    summary: assignmentSummaryRows(input),
    cta: {
      label: "Responder si puedes cubrirla",
      url: input.responseUrl
    }
  });
}

export function buildReplacementCensusInvitationEmail(
  input: ReplacementCensusEmailInput
): EmailTemplate {
  return buildActionEmail({
    subject: "Censo semanal de suplentes PPAM",
    greeting: `Hola ${input.volunteerName},`,
    intro:
      "Estamos preparando la semana. Indica en qué días puedes apoyar como suplente; puedes marcar disponibilidad general o un horario específico.",
    summary: censusSummaryRows(input),
    cta: {
      label: "Responder censo semanal",
      url: input.responseUrl
    }
  });
}

export function buildReplacementCensusReminderEmail(
  input: ReplacementCensusEmailInput
): EmailTemplate {
  return buildActionEmail({
    subject: "Recordatorio: responde el censo semanal de suplentes",
    greeting: `Hola ${input.volunteerName},`,
    intro:
      "Tu respuesta al censo semanal de suplentes sigue pendiente. Por favor indica si puedes apoyar antes del cierre.",
    summary: censusSummaryRows(input),
    cta: {
      label: "Responder censo semanal",
      url: input.responseUrl
    }
  });
}

function buildPendingConfirmationReminderEmail(
  input: AssignmentReminderEmailInput
) {
  const hours = input.offsetHours;
  const invitationType = input.invitationType ?? "PRIMARY";
  const isReplacement = invitationType === "REPLACEMENT";
  const subject = isReplacement
    ? hours
      ? `Recordatorio suplente ${hours}h: responde si puedes cubrir`
      : "Recordatorio suplente: responde si puedes cubrir"
    : hours
      ? `Recordatorio titular ${hours}h: confirma tu asignación`
      : "Recordatorio titular: confirma tu asignación";

  return buildActionEmail({
    subject,
    greeting: `Hola ${input.volunteerName},`,
    intro: isReplacement
      ? "Tu invitación para cubrir como suplente sigue pendiente. Responde antes de que expire para poder confirmar la cobertura."
      : "Tu asignación titular sigue pendiente. Responde antes de que expire para que el sistema pueda organizar el turno.",
    summary: assignmentSummaryRows(input),
    cta: {
      label: isReplacement
        ? "Responder invitación de suplente"
        : "Confirmar o rechazar asignación",
      url: input.responseUrl
    }
  });
}

function buildConfirmedAssignmentReminderEmail(
  input: AssignmentReminderEmailInput
) {
  if (input.kind === "FINAL_HOURS") {
    const hours = input.offsetHours ?? 0;

    return buildActionEmail({
      subject: `Recordatorio final: asignación PPAM en ${hours} horas`,
      greeting: `Hola ${input.volunteerName},`,
      intro:
        "Este es el recordatorio final de tu asignación confirmada de PPAM.",
      summary: assignmentSummaryRows(input),
      cta: {
        label: "Ver detalle de la asignación",
        url: input.responseUrl
      }
    });
  }

  const days = input.offsetDays ?? 0;

  return buildActionEmail({
    subject:
      days === 1
        ? "Recordatorio: asignación PPAM mañana"
        : `Recordatorio: asignación PPAM en ${days} días`,
    greeting: `Hola ${input.volunteerName},`,
    intro: "Te recordamos tu próxima asignación confirmada de PPAM.",
    summary: assignmentSummaryRows(input),
    cta: {
      label: "Ver detalle de la asignación",
      url: input.responseUrl
    }
  });
}

export function buildAssignmentReminderEmail(
  input: AssignmentReminderEmailInput
): EmailTemplate {
  if (input.kind === "PENDING_CONFIRMATION") {
    return buildPendingConfirmationReminderEmail(input);
  }

  return buildConfirmedAssignmentReminderEmail(input);
}

export function buildAssignmentConfirmationReceivedEmail(
  input: VolunteerAssignmentEmailInput & {
    assignmentUrl: string;
  }
): EmailTemplate {
  return buildActionEmail({
    subject: "Confirmación recibida: asignación PPAM",
    greeting: `Hola ${input.volunteerName},`,
    intro:
      "Recibimos tu confirmación. Gracias por apoyar esta asignación de PPAM.",
    summary: assignmentSummaryRows(input),
    cta: {
      label: "Ver detalle de la asignación",
      url: input.assignmentUrl
    }
  });
}

export function buildAdminAssignmentAlertEmail(
  input: AdminAssignmentAlertEmailInput
): EmailTemplate {
  const subject =
    input.reason === "INVITATION_EMAIL_FAILED"
      ? `Alerta admin: fallo de email para ${input.dateLabel}, ${input.timeSlotLabel}`
      : `Alerta admin: asignación sin cobertura para ${input.dateLabel}, ${input.timeSlotLabel}`;
  const invitationTypeLabel = getInvitationTypeLabel(input.invitationType);

  return buildActionEmail({
    subject,
    intro:
      "Se requiere intervención humana para una asignación de PPAM que el sistema no puede resolver por sí solo.",
    summary: [
      ...assignmentSummaryRows(input),
      {
        label: "Titular original",
        value: formatNameList(input.originalVolunteerNames)
      },
      {
        label: "Suplentes intentados",
        value: formatNameList(input.attemptedReplacementNames, "Ninguno")
      },
      { label: "Problema", value: input.reasonLabel },
      { label: "Voluntario afectado", value: input.affectedVolunteerName },
      { label: "Tipo de invitación", value: invitationTypeLabel },
      { label: "Error de email", value: input.errorMessage }
    ],
    cta: {
      label: "Abrir detalle de la asignación",
      url: input.assignmentUrl,
      fallbackLabel: "URL directa:"
    },
    closing:
      "Revisa el caso y decide si contactar a alguien fuera del sistema o marcarlo como resuelto."
  });
}
