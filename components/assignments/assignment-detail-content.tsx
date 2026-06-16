"use client";

import {
  ChevronDown,
  MailCheck,
  MapPin,
  NotebookPen,
  TimerReset,
  Users2
} from "lucide-react";

import { AutomationStateBadge } from "@/components/assignments/automation-state-badge";
import { AssignmentAdminActions } from "@/components/assignments/assignment-admin-actions";
import { AssignmentNotificationActions } from "@/components/assignments/assignment-notification-actions";
import { StatusBadge } from "@/components/assignments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ASSIGNMENT_ACTIVITY_LABELS,
  ASSIGNMENT_INVITATION_STATUS_LABELS,
  ASSIGNMENT_INVITATION_TYPE_LABELS,
  TIME_SLOT_DEFINITIONS,
  VOLUNTEER_POSITION_LABELS
} from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import type {
  AssignmentDetailDto,
  PreachingPointSummary,
  VolunteerSummary
} from "@/types/domain";

type AssignmentDetailContentProps = {
  assignment: AssignmentDetailDto;
  preachingPoints?: PreachingPointSummary[];
  volunteers?: VolunteerSummary[];
  compact?: boolean;
};

const invitationStatusVariants = {
  PENDING: "warning",
  SENT: "default",
  ACCEPTED: "success",
  DECLINED: "danger",
  EXPIRED: "danger",
  FAILED: "danger"
} as const;

const responseStatusLabels = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmó",
  DECLINED: "Rechazó"
} as const;

function getStringMetadata(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function getNumberMetadata(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}

function getTimelineDetail(entry: AssignmentDetailDto["timeline"][number]) {
  const invitationType = getStringMetadata(entry.metadata, "invitationType");
  const responseStatus = getStringMetadata(entry.metadata, "responseStatus");
  const emailAttempts = getNumberMetadata(entry.metadata, "emailAttempts");
  const reason = getStringMetadata(entry.metadata, "reason");
  const notificationLogId = getStringMetadata(
    entry.metadata,
    "notificationLogId"
  );
  const position = getStringMetadata(entry.metadata, "position");

  switch (entry.actionType) {
    case "INVITATION_CREATED":
      return invitationType === "REPLACEMENT"
        ? "Invitación de suplente creada"
        : "Invitación titular creada";
    case "INVITATION_SENT":
      return [
        invitationType === "REPLACEMENT" ? "Suplente" : "Titular",
        emailAttempts ? `intento ${emailAttempts}` : null
      ]
        .filter(Boolean)
        .join(" • ");
    case "INVITATION_FAILED":
      return invitationType === "REPLACEMENT"
        ? "Falló email a suplente"
        : "Falló email a titular";
    case "INVITATION_ACCEPTED":
      return invitationType === "REPLACEMENT"
        ? "Suplente aceptó la invitación"
        : "Titular aceptó la invitación";
    case "INVITATION_DECLINED":
      return invitationType === "REPLACEMENT"
        ? "Suplente rechazó la invitación"
        : "Titular rechazó la invitación";
    case "INVITATION_EXPIRED":
      return invitationType === "REPLACEMENT"
        ? "Invitación de suplente expirada"
        : "Invitación titular expirada";
    case "RESPONSE_RECEIVED":
      return [
        responseStatus === "CONFIRMED"
          ? responseStatusLabels.CONFIRMED
          : responseStatus === "DECLINED"
            ? responseStatusLabels.DECLINED
            : responseStatusLabels.PENDING,
        invitationType === "REPLACEMENT" ? "Suplente" : null
      ]
        .filter(Boolean)
        .join(" • ");
    case "REPLACEMENT_ASSIGNED":
      return position === "FIRST" || position === "SECOND"
        ? `Puesto actualizado: ${VOLUNTEER_POSITION_LABELS[position]}`
        : "Suplente seleccionado";
    case "REPLACEMENT_SELECTED":
      return "Suplente seleccionado por reglas automáticas";
    case "REMINDER_SENT":
      return notificationLogId
        ? "Recordatorio enviado por email"
        : "Recordatorio registrado";
    case "ADMIN_ALERTED":
    case "NO_REPLACEMENT_AVAILABLE":
      return reason ?? "Requiere revisión del administrador";
    case "STATUS_OVERRIDDEN":
      return getStringMetadata(entry.metadata, "nextStatus")
        ? "Estado ajustado manualmente"
        : null;
    default:
      return null;
  }
}

function InvitationList({
  assignment,
  compact = false
}: {
  assignment: AssignmentDetailDto;
  compact?: boolean;
}) {
  if (!assignment.invitations.length) {
    return (
      <p
        className={
          compact
            ? "text-xs text-muted-foreground"
            : "text-sm text-muted-foreground"
        }
      >
        Sin invitaciones registradas todavía.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {assignment.invitations.map((invitation) => (
        <div
          key={invitation.id}
          className={
            compact
              ? "rounded-2xl border border-white/5 bg-white/[0.03] p-3"
              : "rounded-2xl border border-white/5 bg-white/[0.03] p-4"
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{invitation.volunteerName}</p>
              <p
                className={
                  compact
                    ? "text-xs text-muted-foreground"
                    : "text-sm text-muted-foreground"
                }
              >
                {ASSIGNMENT_INVITATION_TYPE_LABELS[invitation.type]} • vence{" "}
                {formatDisplayDate(invitation.expiresAt, "d 'de' MMM, h:mm a")}
              </p>
            </div>
            <Badge variant={invitationStatusVariants[invitation.status]}>
              {ASSIGNMENT_INVITATION_STATUS_LABELS[invitation.status]}
            </Badge>
          </div>
          <p
            className={
              compact
                ? "mt-2 text-xs text-muted-foreground"
                : "mt-2 text-sm text-muted-foreground"
            }
          >
            {invitation.sentAt
              ? `Enviado ${formatDisplayDate(invitation.sentAt, "d 'de' MMM, h:mm a")}`
              : "Email aún no registrado como enviado"}
            {invitation.respondedAt
              ? ` • Respondido ${formatDisplayDate(invitation.respondedAt, "d 'de' MMM, h:mm a")}`
              : ""}
            {invitation.emailAttempts
              ? ` • ${invitation.emailAttempts} intento${invitation.emailAttempts === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AssignmentDetailContent({
  assignment,
  preachingPoints,
  volunteers,
  compact = false
}: AssignmentDetailContentProps) {
  const timelineEntries = assignment.timeline;

  if (!compact) {
    return (
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={assignment.status} />
                <AutomationStateBadge state={assignment.automationState} />
                {assignment.warnings.length ? (
                  <div className="rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-xs text-warning">
                    {assignment.warnings.join(" • ")}
                  </div>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {assignment.automationState.description}
              </p>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Área
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {assignment.preachingPoint.area}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Horario
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <TimerReset className="h-4 w-4 text-muted-foreground" />
                    {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Pareja
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    Pareja {assignment.pairNumber}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Notas
                </p>
                <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                  <NotebookPen className="mt-0.5 h-4 w-4 shrink-0" />
                  {assignment.notes ?? "Sin notas registradas"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <MailCheck className="h-4 w-4" />
                    Proceso automático
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {assignment.automationState.description}
                  </p>
                </div>
                <AutomationStateBadge state={assignment.automationState} />
              </div>
              <InvitationList assignment={assignment} />
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-4 p-6">
              <p className="flex items-center gap-2 font-semibold">
                <Users2 className="h-4 w-4" />
                Voluntarios asignados
              </p>
              <div className="space-y-3">
                {assignment.volunteers.map((volunteer) => (
                  <div
                    key={volunteer.assignmentVolunteerId}
                    className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {volunteer.volunteer.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {VOLUNTEER_POSITION_LABELS[volunteer.position]}
                          {volunteer.isReplacement ? " • Reemplazo" : ""}
                        </p>
                      </div>
                      <StatusBadge status={volunteer.responseStatus} />
                    </div>
                    {volunteer.responseNote ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nota: {volunteer.responseNote}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-4 p-6">
              <p className="font-semibold">Actividad</p>
              <div className="space-y-3">
                {timelineEntries.length ? (
                  timelineEntries.map((entry) => {
                    const detail = getTimelineDetail(entry);

                    return (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-white/5 bg-background/40 p-4"
                      >
                        <p className="text-sm font-medium">
                          {ASSIGNMENT_ACTIVITY_LABELS[entry.actionType]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDisplayDate(
                            entry.createdAt,
                            "d 'de' MMM, h:mm a"
                          )}
                          {entry.actorName ? ` • ${entry.actorName}` : ""}
                        </p>
                        {detail ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {detail}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin actividad todavía.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 xl:sticky xl:top-6">
          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <p className="font-semibold">Confirmaciones</p>
                <p className="text-sm text-muted-foreground">
                  La invitación inicial se envía automáticamente; usa estos
                  controles solo para reintentos manuales.
                </p>
                <AssignmentNotificationActions
                  assignmentId={assignment.id}
                  disabled={!assignment.volunteers.length}
                />
              </div>
            </CardContent>
          </Card>

          {preachingPoints && volunteers ? (
            <Card className="bg-white/[0.03]">
              <CardContent className="space-y-4 p-6">
                <div>
                  <p className="font-semibold">Overrides manuales</p>
                  <p className="text-sm text-muted-foreground">
                    Asigna suplente, marca como resuelto o cancela sin salir del
                    seguimiento.
                  </p>
                </div>
                <AssignmentAdminActions
                  assignment={assignment}
                  preachingPoints={preachingPoints}
                  volunteers={volunteers}
                  showDivider={false}
                  showHeading={false}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-white/[0.03]">
        <CardContent className={compact ? "space-y-4 p-5" : "space-y-5 p-6"}>
          <div className={compact ? "space-y-2.5" : "space-y-3"}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={assignment.status} />
              <AutomationStateBadge state={assignment.automationState} />
            </div>
            <p className="text-xs text-muted-foreground">
              {assignment.automationState.description}
            </p>
            <div
              className={
                compact
                  ? "grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"
                  : "space-y-2 text-sm text-muted-foreground"
              }
            >
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {assignment.preachingPoint.area}
              </p>
              <p className="flex items-center gap-2">
                <TimerReset className="h-4 w-4" />
                {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
              </p>
              <p className="flex items-center gap-2">
                <NotebookPen className="h-4 w-4" />
                {assignment.notes ?? "Sin notas registradas"}
              </p>
            </div>
          </div>

          <div className={compact ? "space-y-2.5" : "space-y-3"}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users2 className="h-4 w-4" />
              Voluntarios asignados
            </p>
            <div className={compact ? "space-y-2" : "space-y-3"}>
              {assignment.volunteers.map((volunteer) => (
                <div
                  key={volunteer.assignmentVolunteerId}
                  className={
                    compact
                      ? "rounded-2xl border border-white/5 bg-white/[0.03] p-3"
                      : "rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{volunteer.volunteer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {VOLUNTEER_POSITION_LABELS[volunteer.position]}
                        {volunteer.isReplacement ? " • Reemplazo" : ""}
                      </p>
                    </div>
                    <StatusBadge status={volunteer.responseStatus} />
                  </div>
                  {volunteer.responseNote ? (
                    <p
                      className={
                        compact
                          ? "mt-1.5 text-xs text-muted-foreground"
                          : "mt-2 text-sm text-muted-foreground"
                      }
                    >
                      Nota: {volunteer.responseNote}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {assignment.warnings.length ? (
            <div
              className={
                compact
                  ? "rounded-2xl border border-warning/20 bg-warning/10 p-3 text-xs text-warning"
                  : "rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning"
              }
            >
              {assignment.warnings.join(" • ")}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="bg-white/[0.03]">
        <CardContent className="space-y-3 p-5">
          <details className="rounded-2xl border border-border/60 bg-background/30 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
              Proceso automático
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <AutomationStateBadge state={assignment.automationState} />
              </div>
              <p className="text-xs text-muted-foreground">
                {assignment.automationState.description}
              </p>
              <InvitationList assignment={assignment} compact />
            </div>
          </details>
        </CardContent>
      </Card>

      <Card className="bg-white/[0.03]">
        <CardContent className={compact ? "space-y-3 p-5" : "space-y-4 p-6"}>
          <div className="space-y-2">
            <p className="font-semibold">Confirmaciones</p>
            <p
              className={
                compact
                  ? "text-xs text-muted-foreground"
                  : "text-sm text-muted-foreground"
              }
            >
              La invitación inicial se envía automáticamente; usa estos
              controles solo para reintentos manuales.
            </p>
            <AssignmentNotificationActions
              assignmentId={assignment.id}
              disabled={!assignment.volunteers.length}
              compact={compact}
            />
          </div>

          {preachingPoints && volunteers ? (
            compact ? (
              <details className="rounded-2xl border border-border/60 bg-background/30 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                  Overrides manuales
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </summary>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajustes operativos de fecha, suplente, estado y cancelación.
                </p>
                <div className="mt-3">
                  <AssignmentAdminActions
                    assignment={assignment}
                    preachingPoints={preachingPoints}
                    volunteers={volunteers}
                    compact
                    showDivider={false}
                    showHeading={false}
                  />
                </div>
              </details>
            ) : (
              <AssignmentAdminActions
                assignment={assignment}
                preachingPoints={preachingPoints}
                volunteers={volunteers}
              />
            )
          ) : null}

          {compact ? (
            <details className="rounded-2xl border border-border/60 bg-background/30 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                Actividad
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </summary>
              <div className="mt-3 space-y-2.5">
                {timelineEntries.length ? (
                  timelineEntries.map((entry) => {
                    const detail = getTimelineDetail(entry);

                    return (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-white/5 bg-background/40 p-3"
                      >
                        <p className="text-sm font-medium">
                          {ASSIGNMENT_ACTIVITY_LABELS[entry.actionType]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDisplayDate(
                            entry.createdAt,
                            "d 'de' MMM, h:mm a"
                          )}
                          {entry.actorName ? ` • ${entry.actorName}` : ""}
                        </p>
                        {detail ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {detail}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin actividad todavía.
                  </p>
                )}
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
