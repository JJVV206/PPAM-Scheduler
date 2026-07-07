import { VOLUNTEER_SERVICE_TYPE_LABELS } from "@/lib/constants/domain";
import { getVolunteerAssignmentRoleLabel } from "@/lib/volunteer-assignment";
import type {
  AssignmentDetailDto,
  OpenSlotDto,
  VolunteerDashboardData,
  VolunteerServiceType,
  VolunteerSummary
} from "@/types/domain";

export type VolunteerRouteKey =
  | "home"
  | "assignments"
  | "openSlots"
  | "availability"
  | "notifications"
  | "profile";

export type VolunteerNavigationItem = {
  key: VolunteerRouteKey;
  href: string;
  label: string;
};

export type VolunteerAssignmentCardVariant =
  | "primary"
  | "replacement"
  | "mixed";

type VolunteerUiCopy = {
  dashboardTitle: string;
  dashboardEmptyDescription: string;
  assignmentsTitle: string;
  assignmentsDescription: string;
  pendingTitle: string;
  pendingDescription: string;
  pendingEmpty: string;
  confirmedTitle: string;
  confirmedDescription: string;
  confirmedEmpty: string;
  historyTitle: string;
  historyDescription: string;
  historyEmpty: string;
  openSlotsTitle: string;
  openSlotsDescription: string;
  openSlotsEmptyTitle: string;
  openSlotsEmptyDescription: string;
};

export type VolunteerUiConfig = {
  serviceType: VolunteerServiceType;
  serviceTypeLabel: string;
  cardVariant: VolunteerAssignmentCardVariant;
  canSeePrimaryAssignments: boolean;
  canSeeReplacementAssignments: boolean;
  canSeeOpenSlots: boolean;
  navigationItems: VolunteerNavigationItem[];
  copy: VolunteerUiCopy;
};

export type VolunteerDashboardModel = {
  config: VolunteerUiConfig;
  volunteerProfileId: string;
  primaryAssignments: AssignmentDetailDto[];
  replacementAssignments: AssignmentDetailDto[];
  primaryPendingAssignments: AssignmentDetailDto[];
  replacementPendingAssignments: AssignmentDetailDto[];
  visiblePendingAssignments: AssignmentDetailDto[];
  primaryConfirmedAssignments: AssignmentDetailDto[];
  replacementConfirmedAssignments: AssignmentDetailDto[];
  visibleConfirmedAssignments: AssignmentDetailDto[];
  primaryHistory: AssignmentDetailDto[];
  replacementHistory: AssignmentDetailDto[];
  visibleHistory: AssignmentDetailDto[];
  visibleOpenSlots: OpenSlotDto[];
  pendingReplacementCensus: VolunteerDashboardData["pendingReplacementCensus"];
  focusAssignment?: AssignmentDetailDto;
  focusOpenSlot?: OpenSlotDto;
};

const baseNavigation = {
  home: {
    key: "home",
    href: "/volunteer",
    label: "Inicio"
  },
  assignments: {
    key: "assignments",
    href: "/volunteer/assignments",
    label: "Mis turnos"
  },
  openSlots: {
    key: "openSlots",
    href: "/volunteer/open-slots",
    label: "Suplencias"
  },
  availability: {
    key: "availability",
    href: "/volunteer/availability",
    label: "Disponibilidad"
  },
  notifications: {
    key: "notifications",
    href: "/volunteer/notifications",
    label: "Notificaciones"
  },
  profile: {
    key: "profile",
    href: "/volunteer/profile",
    label: "Perfil"
  }
} satisfies Record<VolunteerRouteKey, VolunteerNavigationItem>;

const copyByServiceType: Record<VolunteerServiceType, VolunteerUiCopy> = {
  PRIMARY: {
    dashboardTitle: "No tienes turnos próximos asignados",
    dashboardEmptyDescription:
      "No tienes turnos asignados por ahora. Mantén tu disponibilidad actualizada.",
    assignmentsTitle: "Mis turnos",
    assignmentsDescription:
      "Revisa tus turnos pendientes, confirmados y anteriores.",
    pendingTitle: "Turnos que necesitan respuesta",
    pendingDescription: "Confirma o avisa si no puedes asistir.",
    pendingEmpty: "No tienes respuestas pendientes.",
    confirmedTitle: "Turnos confirmados",
    confirmedDescription: "Turnos próximos que ya quedaron registrados.",
    confirmedEmpty: "No hay turnos confirmados próximos.",
    historyTitle: "Historial",
    historyDescription: "Turnos anteriores registrados en tu perfil.",
    historyEmpty: "Todavía no hay turnos anteriores.",
    openSlotsTitle: "Sin suplencias activas",
    openSlotsDescription:
      "Tu perfil no está habilitado para suplencias. Puedes mantener tu disponibilidad general al día desde Mi disponibilidad.",
    openSlotsEmptyTitle: "Sin suplencias activas",
    openSlotsEmptyDescription:
      "Tu perfil no está habilitado para suplencias. Puedes mantener tu disponibilidad general al día desde Mi disponibilidad."
  },
  REPLACEMENT: {
    dashboardTitle: "No hay suplencias compatibles por ahora",
    dashboardEmptyDescription:
      "Actualiza tu disponibilidad para recibir oportunidades cuando haya turnos por cubrir.",
    assignmentsTitle: "Mis suplencias",
    assignmentsDescription:
      "Revisa las suplencias que puedes cubrir, las aceptadas y el historial.",
    pendingTitle: "Suplencias por responder",
    pendingDescription: "Responde si puedes cubrir estos turnos.",
    pendingEmpty: "No tienes suplencias pendientes de respuesta.",
    confirmedTitle: "Suplencias aceptadas",
    confirmedDescription: "Turnos que aceptaste cubrir como suplente.",
    confirmedEmpty: "No tienes suplencias aceptadas próximas.",
    historyTitle: "Historial de suplencias",
    historyDescription: "Suplencias anteriores registradas en tu perfil.",
    historyEmpty: "Todavía no hay suplencias anteriores.",
    openSlotsTitle: "Suplencias disponibles",
    openSlotsDescription:
      "Estos turnos necesitan cobertura y coinciden con tu disponibilidad.",
    openSlotsEmptyTitle: "No hay suplencias compatibles por ahora",
    openSlotsEmptyDescription:
      "Actualiza tu disponibilidad para recibir oportunidades cuando haya turnos por cubrir."
  },
  PRIMARY_AND_REPLACEMENT: {
    dashboardTitle: "No tienes turnos ni suplencias pendientes",
    dashboardEmptyDescription:
      "Tus turnos como titular aparecerán primero; las suplencias compatibles aparecerán después.",
    assignmentsTitle: "Mis turnos",
    assignmentsDescription:
      "Revisa tus turnos como titular y tus suplencias por separado.",
    pendingTitle: "Turnos que necesitan respuesta",
    pendingDescription:
      "Primero responde tus turnos como titular. Después revisa suplencias si hay disponibles.",
    pendingEmpty: "No tienes respuestas pendientes como titular.",
    confirmedTitle: "Compromisos confirmados",
    confirmedDescription: "Turnos y suplencias próximos que ya confirmaste.",
    confirmedEmpty: "No hay compromisos confirmados próximos.",
    historyTitle: "Historial",
    historyDescription: "Turnos y suplencias anteriores registrados.",
    historyEmpty: "Todavía no hay asignaciones anteriores.",
    openSlotsTitle: "Suplencias disponibles",
    openSlotsDescription:
      "Puedes cubrir estas suplencias además de tus turnos como titular.",
    openSlotsEmptyTitle: "No hay suplencias disponibles",
    openSlotsEmptyDescription:
      "No hay suplencias disponibles; tus turnos como titular siguen apareciendo aquí."
  }
};

function navigationForServiceType(
  serviceType: VolunteerServiceType
): VolunteerNavigationItem[] {
  if (serviceType === "PRIMARY") {
    return [
      baseNavigation.home,
      baseNavigation.assignments,
      baseNavigation.availability,
      baseNavigation.notifications,
      baseNavigation.profile
    ];
  }

  if (serviceType === "REPLACEMENT") {
    return [
      baseNavigation.home,
      baseNavigation.openSlots,
      baseNavigation.availability,
      baseNavigation.notifications,
      baseNavigation.profile
    ];
  }

  return [
    baseNavigation.home,
    baseNavigation.assignments,
    baseNavigation.openSlots,
    baseNavigation.availability,
    baseNavigation.notifications,
    baseNavigation.profile
  ];
}

function isReplacementAssignment(
  assignment: AssignmentDetailDto,
  volunteerProfileId: string
) {
  return (
    getVolunteerAssignmentRoleLabel(assignment, volunteerProfileId) ===
    "Suplente"
  );
}

function splitAssignmentsByRole(
  assignments: AssignmentDetailDto[],
  volunteerProfileId: string
) {
  return {
    primary: assignments.filter(
      (assignment) => !isReplacementAssignment(assignment, volunteerProfileId)
    ),
    replacement: assignments.filter((assignment) =>
      isReplacementAssignment(assignment, volunteerProfileId)
    )
  };
}

export function getVolunteerUiConfig(
  volunteer: Pick<
    VolunteerSummary,
    "serviceType" | "canServeAsPrimary" | "canServeAsReplacement"
  >
): VolunteerUiConfig {
  const serviceType = volunteer.serviceType;

  return {
    serviceType,
    serviceTypeLabel: VOLUNTEER_SERVICE_TYPE_LABELS[serviceType],
    cardVariant:
      serviceType === "PRIMARY"
        ? "primary"
        : serviceType === "REPLACEMENT"
          ? "replacement"
          : "mixed",
    canSeePrimaryAssignments: volunteer.canServeAsPrimary,
    canSeeReplacementAssignments: volunteer.canServeAsReplacement,
    canSeeOpenSlots: volunteer.canServeAsReplacement,
    navigationItems: navigationForServiceType(serviceType),
    copy: copyByServiceType[serviceType]
  };
}

export function canAccessVolunteerRoute(
  volunteer: Pick<VolunteerSummary, "canServeAsReplacement">,
  routeKey: VolunteerRouteKey
) {
  if (routeKey === "openSlots") {
    return volunteer.canServeAsReplacement;
  }

  return true;
}

export function getVolunteerDashboardModel(
  dashboard: VolunteerDashboardData
): VolunteerDashboardModel {
  const config = getVolunteerUiConfig(dashboard.volunteer);
  const volunteerProfileId = dashboard.volunteer.id;
  const upcoming = splitAssignmentsByRole(
    dashboard.upcomingAssignments,
    volunteerProfileId
  );
  const pending = splitAssignmentsByRole(
    dashboard.pendingConfirmations,
    volunteerProfileId
  );
  const confirmed = splitAssignmentsByRole(
    dashboard.confirmedAssignments,
    volunteerProfileId
  );
  const history = splitAssignmentsByRole(
    dashboard.assignmentHistory,
    volunteerProfileId
  );
  const visibleOpenSlots = config.canSeeOpenSlots ? dashboard.openSlots : [];
  const visiblePendingAssignments = config.canSeePrimaryAssignments
    ? pending.primary
    : pending.replacement;
  const visibleConfirmedAssignments =
    config.serviceType === "PRIMARY"
      ? confirmed.primary
      : config.serviceType === "REPLACEMENT"
        ? confirmed.replacement
        : dashboard.confirmedAssignments;
  const visibleHistory =
    config.serviceType === "PRIMARY"
      ? history.primary
      : config.serviceType === "REPLACEMENT"
        ? history.replacement
        : dashboard.assignmentHistory;
  const focusAssignment =
    config.serviceType === "REPLACEMENT"
      ? (pending.replacement[0] ??
        confirmed.replacement[0] ??
        upcoming.replacement[0])
      : config.serviceType === "PRIMARY_AND_REPLACEMENT"
        ? (pending.primary[0] ??
          dashboard.confirmedAssignments[0] ??
          dashboard.upcomingAssignments[0])
        : (pending.primary[0] ?? confirmed.primary[0] ?? upcoming.primary[0]);
  const focusOpenSlot =
    config.canSeeOpenSlots && !focusAssignment
      ? visibleOpenSlots[0]
      : undefined;

  return {
    config,
    volunteerProfileId,
    primaryAssignments: upcoming.primary,
    replacementAssignments: upcoming.replacement,
    primaryPendingAssignments: pending.primary,
    replacementPendingAssignments: pending.replacement,
    visiblePendingAssignments,
    primaryConfirmedAssignments: confirmed.primary,
    replacementConfirmedAssignments: confirmed.replacement,
    visibleConfirmedAssignments,
    primaryHistory: history.primary,
    replacementHistory: history.replacement,
    visibleHistory,
    visibleOpenSlots,
    pendingReplacementCensus: dashboard.pendingReplacementCensus,
    focusAssignment,
    focusOpenSlot
  };
}
