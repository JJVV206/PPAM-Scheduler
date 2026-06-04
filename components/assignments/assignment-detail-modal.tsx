"use client";

import { MapPin, NotebookPen, TimerReset, Users2 } from "lucide-react";

import { AssignmentAdminActions } from "@/components/assignments/assignment-admin-actions";
import { AssignmentNotificationActions } from "@/components/assignments/assignment-notification-actions";
import { StatusBadge } from "@/components/assignments/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ASSIGNMENT_ACTIVITY_LABELS,
  TIME_SLOT_DEFINITIONS,
  VOLUNTEER_POSITION_LABELS
} from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import type {
  AssignmentDetailDto,
  PreachingPointSummary,
  VolunteerSummary
} from "@/types/domain";

type AssignmentDetailModalProps = {
  assignment: AssignmentDetailDto;
  triggerLabel?: string;
  preachingPoints?: PreachingPointSummary[];
  volunteers?: VolunteerSummary[];
};

export function AssignmentDetailModal({
  assignment,
  triggerLabel = "Ver detalles",
  preachingPoints,
  volunteers
}: AssignmentDetailModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{assignment.preachingPoint.name}</DialogTitle>
          <DialogDescription>
            Pareja {assignment.pairNumber} •{" "}
            {formatDisplayDate(assignment.date, "EEEE d 'de' MMM")} •{" "}
            {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-5 p-6">
              <div className="space-y-3">
                <StatusBadge status={assignment.status} />
                <div className="space-y-2 text-sm text-muted-foreground">
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

              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
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
              </div>

              {assignment.warnings.length ? (
                <div className="rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
                  {assignment.warnings.join(" • ")}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <p className="font-semibold">Confirmaciones</p>
                <p className="text-sm text-muted-foreground">
                  Dispara la solicitud inicial o reenvía recordatorios a quienes
                  sigan pendientes.
                </p>
                <AssignmentNotificationActions
                  assignmentId={assignment.id}
                  disabled={!assignment.volunteers.length}
                />
              </div>

              {preachingPoints && volunteers ? (
                <AssignmentAdminActions
                  assignment={assignment}
                  preachingPoints={preachingPoints}
                  volunteers={volunteers}
                />
              ) : null}

              <div className="border-t border-border/60 pt-4">
                <p className="font-semibold">Actividad</p>
                <div className="space-y-3">
                  {assignment.timeline.length ? (
                    assignment.timeline.map((entry) => (
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
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin actividad todavía.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
