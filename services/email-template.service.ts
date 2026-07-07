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
  tone?: "default" | "danger";
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

function getToneStyles(tone: BuildActionEmailInput["tone"]) {
  if (tone === "danger") {
    return {
      accent: "#dc2626",
      accentDark: "#991b1b",
      accentSoft: "#fef2f2",
      border: "#fecaca",
      buttonText: "#ffffff"
    };
  }

  return {
    accent: "#14b8a6",
    accentDark: "#0f766e",
    accentSoft: "#ecfdf5",
    border: "#99f6e4",
    buttonText: "#042f2e"
  };
}

function buildActionEmail(input: BuildActionEmailInput): EmailTemplate {
  const visibleRows = input.summary.filter((row) => row.value?.trim());
  const greeting = input.greeting ? normalizeText(input.greeting) : undefined;
  const intro = normalizeText(input.intro);
  const closing =
    input.closing ?? "Gracias por apoyar la organización de PPAM.";
  const tone = getToneStyles(input.tone);
  const fallbackLabel = input.cta
    ? getActionFallbackLabel(input.cta.fallbackLabel)
    : undefined;
  const summaryHtml = visibleRows.length
    ? [
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e5e7eb;border-radius:14px;border-collapse:separate;overflow:hidden;background:#ffffff;">`,
        ...visibleRows.map(
          (row, index) =>
            `<tr><td style="width:34%;padding:14px 18px;border-top:${
              index === 0 ? "0" : "1px solid #e5e7eb"
            };font-size:12px;line-height:18px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;background:#f9fafb;">${escapeHtml(
              row.label
            )}</td><td style="padding:14px 18px;border-top:${
              index === 0 ? "0" : "1px solid #e5e7eb"
            };font-size:15px;line-height:22px;font-weight:600;color:#111827;">${escapeHtml(
              row.value ?? ""
            )}</td></tr>`
        ),
        "</table>"
      ].join("")
    : "";
  const ctaHtml = input.cta
    ? [
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 18px;"><tr><td>`,
        `<a href="${escapeHtml(
          input.cta.url
        )}" style="display:inline-block;border-radius:10px;background:${tone.accent};padding:14px 22px;font-size:15px;line-height:20px;font-weight:800;color:${tone.buttonText};text-decoration:none;">${escapeHtml(
          input.cta.label
        )}</a>`,
        `</td></tr></table>`,
        `<p style="margin:18px 0 8px;font-size:13px;line-height:20px;color:#6b7280;">${escapeHtml(
          fallbackLabel ?? ""
        )}</p>`,
        `<p style="margin:0;word-break:break-all;border-radius:10px;background:#f3f4f6;padding:12px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:12px;line-height:18px;color:#374151;"><a href="${escapeHtml(
          input.cta.url
        )}" style="color:${tone.accentDark};text-decoration:underline;">${escapeHtml(
          input.cta.url
        )}</a></p>`
      ].join("")
    : "";
  const html = [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(input.subject)}</title>`,
    "</head>",
    `<body style="margin:0;background:#f4f7f8;padding:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">`,
    `<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${escapeHtml(
      intro
    )}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:28px 12px;">`,
    "<tr>",
    '<td align="center">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:separate;border-spacing:0;">`,
    "<tr>",
    `<td style="padding:0 0 14px 0;"><div style="font-size:13px;line-height:18px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${tone.accentDark};">PPAM Organizer</div></td>`,
    "</tr>",
    "<tr>",
    `<td style="overflow:hidden;border:1px solid #dbe3e6;border-radius:20px;background:#ffffff;box-shadow:0 18px 45px rgba(15,23,42,.08);">`,
    `<div style="height:6px;background:${tone.accent};"></div>`,
    '<div style="padding:34px 32px 30px;">',
    `<div style="display:inline-block;border:1px solid ${tone.border};border-radius:999px;background:${tone.accentSoft};padding:6px 11px;font-size:12px;line-height:16px;font-weight:800;color:${tone.accentDark};">Notificación PPAM</div>`,
    `<h1 style="margin:18px 0 12px;font-size:24px;line-height:31px;font-weight:800;color:#0f172a;">${escapeHtml(
      input.subject
    )}</h1>`,
    greeting
      ? `<p style="margin:0 0 12px;font-size:16px;line-height:25px;color:#374151;">${escapeHtml(
          greeting
        )}</p>`
      : "",
    `<p style="margin:0;font-size:16px;line-height:25px;color:#374151;">${escapeHtml(
      intro
    )}</p>`,
    summaryHtml,
    ctaHtml,
    `<p style="margin:24px 0 0;font-size:14px;line-height:22px;color:#4b5563;">${escapeHtml(
      closing
    )}</p>`,
    "</div>",
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:18px 4px 0;text-align:center;font-size:12px;line-height:18px;color:#6b7280;">Este correo fue generado automáticamente por PPAM Organizer.</td>',
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>"
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
      "Revisa el caso y decide si contactar a alguien fuera del sistema o marcarlo como resuelto.",
    tone: "danger"
  });
}
