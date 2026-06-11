"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { TimeSlotOptionButton } from "@/components/assignments/time-slot-option-button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DAY_LABELS,
  TIME_SLOTS
} from "@/lib/constants/domain";
import { cn } from "@/lib/utils";
import type {
  AssignmentDetailDto,
  DayOfWeek,
  PreachingPointSummary,
  TimeSlot,
  VolunteerSummary
} from "@/types/domain";

type AssignmentAdminActionsProps = {
  assignment: AssignmentDetailDto;
  preachingPoints: PreachingPointSummary[];
  volunteers: VolunteerSummary[];
  compact?: boolean;
  showDivider?: boolean;
  showHeading?: boolean;
};

function getDayOfWeekFromDate(value: string): DayOfWeek {
  const date = new Date(`${value}T12:00:00`);
  const sundayFirstOrder: DayOfWeek[] = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY"
  ];
  return sundayFirstOrder[date.getDay()];
}

function toAssignmentIsoDate(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function AssignmentAdminActions({
  assignment,
  preachingPoints,
  volunteers,
  compact = false,
  showDivider = true,
  showHeading = true
}: AssignmentAdminActionsProps) {
  const router = useRouter();
  const [assignmentDate, setAssignmentDate] = useState(
    assignment.date.toISOString().slice(0, 10)
  );
  const [timeSlot, setTimeSlot] = useState<TimeSlot>(assignment.timeSlot);
  const [preachingPointId, setPreachingPointId] = useState(
    assignment.preachingPoint.id
  );
  const [volunteerOneId, setVolunteerOneId] = useState(
    assignment.volunteers.find((item) => item.position === "FIRST")
      ?.volunteerId ?? ""
  );
  const [volunteerTwoId, setVolunteerTwoId] = useState(
    assignment.volunteers.find((item) => item.position === "SECOND")
      ?.volunteerId ?? ""
  );
  const [notes, setNotes] = useState(assignment.notes ?? "");
  const [loading, setLoading] = useState<"save" | "delete" | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const selectedDayOfWeek = useMemo(
    () => getDayOfWeekFromDate(assignmentDate),
    [assignmentDate]
  );

  const compatiblePoints = useMemo(
    () =>
      preachingPoints.filter(
        (point) =>
          point.activeSlots.length === 0 ||
          point.activeSlots.some(
            (slot) =>
              slot.dayOfWeek === selectedDayOfWeek && slot.timeSlot === timeSlot
          )
      ),
    [preachingPoints, selectedDayOfWeek, timeSlot]
  );

  const selectablePoints = compatiblePoints.length
    ? compatiblePoints
    : preachingPoints;

  useEffect(() => {
    if (
      selectablePoints.length &&
      !selectablePoints.some((point) => point.id === preachingPointId)
    ) {
      setPreachingPointId(selectablePoints[0].id);
    }
  }, [selectablePoints, preachingPointId]);

  async function handleSave() {
    setLoading("save");
    setFeedback(null);

    const response = await fetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        date: toAssignmentIsoDate(assignmentDate),
        dayOfWeek: selectedDayOfWeek,
        timeSlot,
        preachingPointId,
        notes: notes.trim() ? notes : null,
        volunteers: [
          volunteerOneId
            ? { volunteerId: volunteerOneId, position: "FIRST" as const }
            : null,
          volunteerTwoId
            ? { volunteerId: volunteerTwoId, position: "SECOND" as const }
            : null
        ].filter(Boolean)
      })
    });
    const result = await response.json();

    setLoading(null);
    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok ? "Asignación actualizada." : result.error
    });

    if (response.ok) {
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!window.confirm("Se eliminará esta asignación. ¿Deseas continuar?")) {
      return;
    }

    setLoading("delete");
    setFeedback(null);

    const response = await fetch(`/api/assignments/${assignment.id}`, {
      method: "DELETE"
    });
    const result = await response.json();

    setLoading(null);
    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok ? "Asignación eliminada." : result.error
    });

    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div
      className={cn(
        compact ? "space-y-3" : "space-y-4",
        showDivider && "border-t border-border/60",
        showDivider && (compact ? "pt-3" : "pt-4")
      )}
    >
      {showHeading ? (
        <div>
          <p className="font-semibold">Editar asignación</p>
          <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
            Ajusta fecha, horario o pareja sin salir del seguimiento.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Fecha</label>
          <Input
            type="date"
            className={compact ? "h-10" : undefined}
            value={assignmentDate}
            onChange={(event) => setAssignmentDate(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Día detectado</label>
          <div
            className={cn(
              "rounded-2xl border border-border/70 bg-background/35 text-muted-foreground",
              compact ? "px-4 py-2.5 text-sm" : "px-4 py-3 text-sm"
            )}
          >
            {DAY_LABELS[selectedDayOfWeek]}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="text-sm font-medium">Horario</label>
        <div className={cn("grid gap-2", compact ? "grid-cols-2 md:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-5")}>
          {TIME_SLOTS.map((slot) => (
            <TimeSlotOptionButton
              key={slot}
              slot={slot}
              selected={timeSlot === slot}
              onClick={() => setTimeSlot(slot)}
              className={compact ? "px-2.5 py-2" : undefined}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Voluntario 1</label>
          <Select value={volunteerOneId} onValueChange={setVolunteerOneId}>
            <SelectTrigger className={compact ? "h-10" : undefined}>
              <SelectValue placeholder="Primer puesto" />
            </SelectTrigger>
            <SelectContent>
              {volunteers.map((volunteer) => (
                <SelectItem key={volunteer.id} value={volunteer.id}>
                  {volunteer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Voluntario 2</label>
          <Select value={volunteerTwoId} onValueChange={setVolunteerTwoId}>
            <SelectTrigger className={compact ? "h-10" : undefined}>
              <SelectValue placeholder="Segundo puesto" />
            </SelectTrigger>
            <SelectContent>
              {volunteers.map((volunteer) => (
                <SelectItem key={volunteer.id} value={volunteer.id}>
                  {volunteer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Notas</label>
        <Textarea
          rows={compact ? 3 : 5}
          className={compact ? "min-h-[88px]" : undefined}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Indicaciones operativas"
        />
      </div>

      <FeedbackMessage
        className={compact ? "text-xs" : undefined}
        message={feedback?.text}
        tone={feedback?.tone}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="danger"
          size={compact ? "sm" : "default"}
          onClick={handleDelete}
          disabled={loading !== null}
        >
          {loading === "delete" ? "Eliminando..." : "Eliminar asignación"}
        </Button>
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          onClick={handleSave}
          disabled={
            loading !== null ||
            !assignmentDate ||
            !preachingPointId ||
            (volunteerOneId !== "" && volunteerOneId === volunteerTwoId)
          }
        >
          {loading === "save" ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
