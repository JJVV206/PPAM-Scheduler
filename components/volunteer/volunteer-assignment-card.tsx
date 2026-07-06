import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CircleOff,
  MapPin,
  UserRound
} from "lucide-react";

import { StatusBadge } from "@/components/assignments/status-badge";
import { VolunteerResponseActions } from "@/components/volunteer/volunteer-response-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATION_TYPE_LABELS,
  TIME_SLOT_DEFINITIONS
} from "@/lib/constants/domain";
import { cn, formatDisplayDate } from "@/lib/utils";
import {
  canVolunteerRespondToAssignment,
  getVolunteerAssignmentRoleLabel,
  getVolunteerAssignmentSlot
} from "@/lib/volunteer-assignment";
import type { VolunteerAssignmentCardVariant } from "@/lib/volunteer-ui-config";
import type {
  AssignmentDetailDto,
  ResponseStatus,
  VolunteerAssignmentReminderDto
} from "@/types/domain";

type VolunteerAssignmentCardProps = {
  assignment: AssignmentDetailDto;
  volunteerProfileId: string;
  reminders?: VolunteerAssignmentReminderDto[];
  showResponseActions?: boolean;
  showDetailLink?: boolean;
  compact?: boolean;
  variant?: VolunteerAssignmentCardVariant;
  className?: string;
};

function getReminderText(reminders: VolunteerAssignmentReminderDto[]) {
  if (!reminders.length) {
    return "Sin recordatorios recibidos";
  }

  const lastReminder = reminders[0];
  const typeLabel =
    NOTIFICATION_TYPE_LABELS[lastReminder.type] ?? "Recordatorio";
  const date = formatDisplayDate(
    lastReminder.sentAt ?? lastReminder.createdAt,
    "d 'de' MMM, h:mm a"
  );

  return `${reminders.length} recordatorio${
    reminders.length === 1 ? "" : "s"
  } recibido${reminders.length === 1 ? "" : "s"} • ${typeLabel} ${date}`;
}

function getResponseSummary(
  status: ResponseStatus,
  variant: VolunteerAssignmentCardVariant
) {
  const isReplacement = variant === "replacement";
  const confirmedSummary = isReplacement
    ? "Tu suplencia quedó confirmada. Revisa los recordatorios antes de asistir."
    : "Tu turno quedó confirmado. Revisa los recordatorios antes de asistir.";

  if (status === "CONFIRMED") {
    return {
      icon: CheckCircle2,
      title: "Asistencia confirmada",
      body: confirmedSummary,
      className: "border-success/35 bg-success/[0.08] text-success"
    };
  }

  if (status === "DECLINED") {
    return {
      icon: CircleOff,
      title: "Avisaste que no puedes asistir",
      body: "Tu respuesta quedó registrada y el equipo buscará cobertura si hace falta.",
      className: "border-danger/35 bg-danger/[0.08] text-danger"
    };
  }

  return {
    icon: AlertTriangle,
    title: "Necesita respuesta",
    body: isReplacement
      ? "Confirma si puedes cubrirla o avisa si no puedes tomar esta suplencia."
      : "Confirma si asistirás o avisa si no puedes para buscar cobertura a tiempo.",
    className: "border-warning/35 bg-warning/[0.08] text-warning"
  };
}

export function VolunteerAssignmentCard({
  assignment,
  volunteerProfileId,
  reminders = [],
  showResponseActions = false,
  showDetailLink = true,
  compact = false,
  variant = "mixed",
  className
}: VolunteerAssignmentCardProps) {
  const volunteerSlot = getVolunteerAssignmentSlot(
    assignment,
    volunteerProfileId
  );
  const roleLabel = getVolunteerAssignmentRoleLabel(
    assignment,
    volunteerProfileId
  );
  const cardVariant =
    variant === "mixed"
      ? roleLabel === "Suplente"
        ? "replacement"
        : "primary"
      : variant;
  const responseStatus = volunteerSlot?.responseStatus ?? "PENDING";
  const responseSummary = getResponseSummary(responseStatus, cardVariant);
  const ResponseIcon = responseSummary.icon;
  const responseId = canVolunteerRespondToAssignment(
    assignment,
    volunteerProfileId
  )
    ? volunteerSlot?.responseId
    : null;

  return (
    <article
      className={cn(
        "rounded-lg border border-border/70 bg-white/[0.03] p-4",
        responseStatus === "PENDING" && "border-warning/35 bg-warning/[0.03]",
        compact ? "space-y-3" : "space-y-4",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={roleLabel === "Suplente" ? "default" : "secondary"}>
              {roleLabel}
            </Badge>
            <StatusBadge status={responseStatus} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {cardVariant === "replacement" ? "Tu suplencia" : "Tu turno"}
            </p>
            <h2 className="mt-1 font-heading text-xl font-semibold text-foreground">
              {assignment.preachingPoint.name}
            </h2>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Pareja {assignment.pairNumber}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" />
            Fecha
          </p>
          <p className="mt-1 font-medium">
            {formatDisplayDate(assignment.date, "EEEE d 'de' MMM")}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-4 w-4 shrink-0" />
            Horario
          </p>
          <p className="mt-1 font-medium">
            {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            Zona
          </p>
          <p className="mt-1 font-medium">{assignment.preachingPoint.area}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserRound className="h-4 w-4 shrink-0" />
            Tipo
          </p>
          <p className="mt-1 font-medium">
            {roleLabel === "Suplente" ? "Suplente" : "Titular"}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border px-3 py-2 text-sm",
          responseSummary.className
        )}
      >
        <p className="flex items-start gap-2">
          <ResponseIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold text-foreground">
              {responseSummary.title}.
            </span>{" "}
            <span className="text-muted-foreground">
              {responseSummary.body}
            </span>
          </span>
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{getReminderText(reminders)}</span>
        </p>
      </div>

      {showResponseActions && responseId ? (
        <VolunteerResponseActions
          responseId={responseId}
          currentStatus={responseStatus}
          initialNote={volunteerSlot?.responseNote}
          compact={compact}
        />
      ) : null}

      {showDetailLink ? (
        <div className="flex border-t border-border/60 pt-3 sm:justify-end">
          <Button
            variant="secondary"
            size={compact ? "sm" : "default"}
            className="w-full sm:w-auto"
            asChild
          >
            <Link href={`/volunteer/assignments/${assignment.id}`}>
              Ver detalles
            </Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}
