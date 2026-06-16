import Link from "next/link";
import {
  BellRing,
  CalendarDays,
  Clock3,
  MapPin,
  UserRound
} from "lucide-react";

import { AutomationStateBadge } from "@/components/assignments/automation-state-badge";
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
  getVolunteerAssignmentRoleLabel,
  getVolunteerAssignmentSlot
} from "@/lib/volunteer-assignment";
import type {
  AssignmentDetailDto,
  VolunteerAssignmentReminderDto
} from "@/types/domain";

type VolunteerAssignmentCardProps = {
  assignment: AssignmentDetailDto;
  volunteerProfileId: string;
  reminders?: VolunteerAssignmentReminderDto[];
  showResponseActions?: boolean;
  showDetailLink?: boolean;
  compact?: boolean;
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

export function VolunteerAssignmentCard({
  assignment,
  volunteerProfileId,
  reminders = [],
  showResponseActions = false,
  showDetailLink = true,
  compact = false,
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

  return (
    <article
      className={cn(
        "border-white/6 rounded-[24px] border bg-white/[0.03] p-4",
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
            <StatusBadge status={volunteerSlot?.responseStatus ?? "PENDING"} />
            <AutomationStateBadge state={assignment.automationState} />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {assignment.preachingPoint.name}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Pareja {assignment.pairNumber}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={assignment.status} />
        </div>
      </div>

      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {formatDisplayDate(assignment.date, "EEEE d 'de' MMM")}
        </p>
        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 shrink-0" />
          {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          {assignment.preachingPoint.area}
        </p>
        <p className="flex items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0" />
          {roleLabel === "Suplente"
            ? "Asignación como suplente"
            : "Asignación titular"}
        </p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-background/30 px-3 py-2 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{getReminderText(reminders)}</span>
        </p>
      </div>

      {showResponseActions && volunteerSlot?.responseId ? (
        <VolunteerResponseActions
          responseId={volunteerSlot.responseId}
          currentStatus={volunteerSlot.responseStatus}
          initialNote={volunteerSlot.responseNote}
          compact={compact}
        />
      ) : null}

      {showDetailLink ? (
        <div className="flex justify-end border-t border-white/5 pt-3">
          <Button variant="secondary" size={compact ? "sm" : "default"} asChild>
            <Link href={`/volunteer/assignments/${assignment.id}`}>
              Ver detalles
            </Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}
