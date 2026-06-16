import type {
  AssignmentActivityType,
  AssignmentAutomationState,
  AssignmentInvitationStatus,
  AssignmentInvitationType,
  AssignmentStatus,
  ResponseStatus
} from "@/types/domain";

type AssignmentUiInvitation = {
  type: AssignmentInvitationType;
  status: AssignmentInvitationStatus;
  sentAt?: Date | null;
  respondedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
};

type AssignmentUiVolunteer = {
  responseStatus: ResponseStatus;
  isReplacement?: boolean;
};

type AssignmentUiTimelineEntry = {
  actionType: AssignmentActivityType;
  createdAt: Date;
};

type AssignmentAutomationStateInput = {
  status: AssignmentStatus;
  invitations: AssignmentUiInvitation[];
  volunteers: AssignmentUiVolunteer[];
  timeline: AssignmentUiTimelineEntry[];
};

const ACTIVE_INVITATION_STATUSES: AssignmentInvitationStatus[] = [
  "PENDING",
  "SENT"
];

const ATTENTION_ACTIVITY_TYPES: AssignmentActivityType[] = [
  "ADMIN_ALERTED",
  "INVITATION_FAILED",
  "NO_REPLACEMENT_AVAILABLE"
];

const AUTOMATION_STATES: Record<
  AssignmentAutomationState["key"],
  AssignmentAutomationState
> = {
  INVITATION_PENDING: {
    key: "INVITATION_PENDING",
    label: "Invitación pendiente",
    description:
      "La invitación existe, pero todavía no queda registrada como enviada.",
    tone: "warning"
  },
  EMAIL_SENT: {
    key: "EMAIL_SENT",
    label: "Email enviado",
    description:
      "El correo fue enviado y el sistema está preparando el seguimiento.",
    tone: "info"
  },
  AWAITING_RESPONSE: {
    key: "AWAITING_RESPONSE",
    label: "Esperando respuesta",
    description:
      "El email ya fue enviado y hay al menos una respuesta pendiente.",
    tone: "warning"
  },
  CONFIRMED: {
    key: "CONFIRMED",
    label: "Confirmado",
    description:
      "La asignación quedó cubierta por el flujo automático o manual.",
    tone: "success"
  },
  DECLINED: {
    key: "DECLINED",
    label: "Rechazado",
    description:
      "Se recibió un rechazo y el sistema debe resolver la cobertura.",
    tone: "danger"
  },
  EXPIRED: {
    key: "EXPIRED",
    label: "Expirado",
    description:
      "Una invitación venció sin respuesta y el flujo automático debe continuar.",
    tone: "danger"
  },
  LOOKING_FOR_REPLACEMENT: {
    key: "LOOKING_FOR_REPLACEMENT",
    label: "Buscando suplente",
    description:
      "La asignación necesita reemplazo y el motor automático está buscando candidato.",
    tone: "warning"
  },
  REPLACEMENT_INVITED: {
    key: "REPLACEMENT_INVITED",
    label: "Suplente invitado",
    description:
      "Ya hay una invitación activa para un suplente y se espera su respuesta.",
    tone: "info"
  },
  REQUIRES_INTERVENTION: {
    key: "REQUIRES_INTERVENTION",
    label: "Requiere intervención",
    description:
      "El sistema detectó una condición que necesita revisión manual del administrador.",
    tone: "danger"
  }
};

function byNewestCreatedAt(
  left: AssignmentUiInvitation,
  right: AssignmentUiInvitation
) {
  return right.createdAt.getTime() - left.createdAt.getTime();
}

function isActiveInvitation(invitation: AssignmentUiInvitation) {
  return ACTIVE_INVITATION_STATUSES.includes(invitation.status);
}

function hasAttentionActivity(timeline: AssignmentUiTimelineEntry[]) {
  return timeline.some((entry) =>
    ATTENTION_ACTIVITY_TYPES.includes(entry.actionType)
  );
}

function isCovered(input: AssignmentAutomationStateInput) {
  if (["CONFIRMED", "COMPLETED"].includes(input.status)) {
    return true;
  }

  return (
    input.status === "REASSIGNED" &&
    !input.volunteers.some(
      (volunteer) => volunteer.responseStatus === "DECLINED"
    )
  );
}

export function deriveAssignmentAutomationState(
  input: AssignmentAutomationStateInput
): AssignmentAutomationState {
  const sortedInvitations = [...input.invitations].sort(byNewestCreatedAt);
  const latestInvitation = sortedInvitations[0];
  const activeReplacementInvitation = sortedInvitations.find(
    (invitation) =>
      invitation.type === "REPLACEMENT" && isActiveInvitation(invitation)
  );
  const activePrimaryInvitation = sortedInvitations.find(
    (invitation) =>
      invitation.type === "PRIMARY" && isActiveInvitation(invitation)
  );
  const hasPendingResponse = input.volunteers.some(
    (volunteer) => volunteer.responseStatus === "PENDING"
  );
  const hasDeclinedResponse = input.volunteers.some(
    (volunteer) => volunteer.responseStatus === "DECLINED"
  );
  const hasFailedInvitation = sortedInvitations.some(
    (invitation) => invitation.status === "FAILED"
  );

  if (activeReplacementInvitation) {
    return AUTOMATION_STATES.REPLACEMENT_INVITED;
  }

  if (isCovered(input)) {
    return AUTOMATION_STATES.CONFIRMED;
  }

  if (
    input.status === "CANCELLED" ||
    hasFailedInvitation ||
    hasAttentionActivity(input.timeline)
  ) {
    return AUTOMATION_STATES.REQUIRES_INTERVENTION;
  }

  if (input.status === "NEEDS_REPLACEMENT") {
    return AUTOMATION_STATES.LOOKING_FOR_REPLACEMENT;
  }

  if (
    input.timeline.some((entry) => entry.actionType === "REPLACEMENT_REQUIRED")
  ) {
    return AUTOMATION_STATES.LOOKING_FOR_REPLACEMENT;
  }

  if (
    hasDeclinedResponse ||
    latestInvitation?.status === "DECLINED" ||
    input.status === "DECLINED"
  ) {
    return AUTOMATION_STATES.DECLINED;
  }

  if (latestInvitation?.status === "EXPIRED") {
    return AUTOMATION_STATES.EXPIRED;
  }

  if (activePrimaryInvitation?.status === "PENDING") {
    return AUTOMATION_STATES.INVITATION_PENDING;
  }

  if (activePrimaryInvitation?.status === "SENT") {
    return hasPendingResponse
      ? AUTOMATION_STATES.AWAITING_RESPONSE
      : AUTOMATION_STATES.EMAIL_SENT;
  }

  if (latestInvitation?.status === "ACCEPTED") {
    return AUTOMATION_STATES.CONFIRMED;
  }

  if (!sortedInvitations.length && hasPendingResponse) {
    return AUTOMATION_STATES.INVITATION_PENDING;
  }

  return AUTOMATION_STATES.CONFIRMED;
}

export function isAssignmentRequiringAttention(
  input: AssignmentAutomationStateInput
) {
  if (
    ["CONFIRMED", "COMPLETED", "REASSIGNED", "CANCELLED"].includes(input.status)
  ) {
    return false;
  }

  return deriveAssignmentAutomationState(input).key === "REQUIRES_INTERVENTION";
}
