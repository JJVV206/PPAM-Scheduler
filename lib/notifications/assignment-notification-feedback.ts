export type AssignmentNotificationActionKind = "request" | "reminder";

export type AssignmentNotificationFeedback = {
  tone: "success" | "error";
  text: string;
};

type AssignmentNotificationPayload = {
  sentCount?: unknown;
  error?: unknown;
  message?: unknown;
};

const GENERIC_ERROR_MESSAGE = "No fue posible completar la acción.";

function getSuccessMessage(
  kind: AssignmentNotificationActionKind,
  sentCount: number | null
) {
  if (sentCount === null) {
    return kind === "request"
      ? "Invitaciones pendientes enviadas."
      : "Emails reenviados.";
  }

  return kind === "request"
    ? `Invitaciones pendientes enviadas (${sentCount}).`
    : `Emails reenviados (${sentCount}).`;
}

function getHttpErrorMessage(status: number) {
  if (status === 401) {
    return "Tu sesión expiró. Inicia sesión de nuevo.";
  }

  if (status === 403) {
    return "No tienes permisos para enviar emails de asignaciones.";
  }

  if (status >= 500) {
    return "El servidor no pudo enviar el email. Revisa la configuración e intenta de nuevo.";
  }

  return GENERIC_ERROR_MESSAGE;
}

function getPayloadError(payload: AssignmentNotificationPayload | null) {
  if (!payload) {
    return null;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return null;
}

async function readJsonPayload(response: Response) {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as AssignmentNotificationPayload;
  } catch {
    return null;
  }
}

export async function buildAssignmentNotificationFeedback(
  response: Response,
  kind: AssignmentNotificationActionKind
): Promise<AssignmentNotificationFeedback> {
  const payload = await readJsonPayload(response);

  if (response.ok) {
    return {
      tone: "success",
      text: getSuccessMessage(
        kind,
        typeof payload?.sentCount === "number" ? payload.sentCount : null
      )
    };
  }

  return {
    tone: "error",
    text: getPayloadError(payload) ?? getHttpErrorMessage(response.status)
  };
}

export function buildAssignmentNotificationNetworkErrorFeedback() {
  return {
    tone: "error" as const,
    text: "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo."
  };
}
