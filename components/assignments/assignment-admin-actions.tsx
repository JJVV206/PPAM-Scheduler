"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { TimeSlotOptionButton } from "@/components/assignments/time-slot-option-button";
import { useAssignmentPreflightWarnings } from "@/components/assignments/use-assignment-preflight-warnings";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DAY_LABELS, TIME_SLOTS } from "@/lib/constants/domain";
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

const MIN_VISIBLE_MEMBER_FIELDS = 2;
const UNASSIGNED_VOLUNTEER_VALUE = "__unassigned__";

function normalizeSelectedVolunteerIds(volunteerIds: string[]) {
  return volunteerIds.filter(Boolean);
}

function hasDuplicateVolunteerIds(volunteerIds: string[]) {
  const selectedVolunteerIds = normalizeSelectedVolunteerIds(volunteerIds);
  return new Set(selectedVolunteerIds).size !== selectedVolunteerIds.length;
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
  const [memberVolunteerIds, setMemberVolunteerIds] = useState(() =>
    assignment.volunteers
      .slice()
      .sort((left, right) => left.slotNumber - right.slotNumber)
      .map((item) => item.volunteerId)
      .concat(Array.from({ length: MIN_VISIBLE_MEMBER_FIELDS }, () => ""))
      .slice(
        0,
        Math.max(assignment.volunteers.length, MIN_VISIBLE_MEMBER_FIELDS)
      )
  );
  const [notes, setNotes] = useState(assignment.notes ?? "");
  const [loading, setLoading] = useState<"save" | "resolve" | "cancel" | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const volunteerOptions = useMemo(() => {
    const options = new Map<string, VolunteerSummary>();

    for (const volunteer of volunteers) {
      if (volunteer.canServeAsPrimary) {
        options.set(volunteer.id, volunteer);
      }
    }

    for (const slot of assignment.volunteers) {
      options.set(slot.volunteer.id, slot.volunteer);
    }

    return [...options.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "es-MX")
    );
  }, [assignment.volunteers, volunteers]);
  const selectedMemberVolunteerIds = useMemo(
    () => normalizeSelectedVolunteerIds(memberVolunteerIds),
    [memberVolunteerIds]
  );
  const canAddMemberField = memberVolunteerIds.length < volunteerOptions.length;

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
  const assignmentIsoDate = useMemo(
    () => (assignmentDate ? toAssignmentIsoDate(assignmentDate) : ""),
    [assignmentDate]
  );
  const preflightWarnings = useAssignmentPreflightWarnings({
    assignmentId: assignment.id,
    date: assignmentIsoDate,
    timeSlot,
    volunteerIds: selectedMemberVolunteerIds
  });

  function setMemberVolunteerId(index: number, volunteerId: string) {
    setMemberVolunteerIds((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? volunteerId : item
      )
    );
  }

  function addMemberField() {
    setMemberVolunteerIds((current) =>
      current.length < volunteerOptions.length ? [...current, ""] : current
    );
  }

  function removeMemberField(index: number) {
    setMemberVolunteerIds((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length >= MIN_VISIBLE_MEMBER_FIELDS
        ? next
        : Array.from(
            { length: MIN_VISIBLE_MEMBER_FIELDS },
            (_, itemIndex) => next[itemIndex] ?? ""
          );
    });
  }

  function getSelectableVolunteers(index: number) {
    const selectedIds = new Set(
      memberVolunteerIds.filter((volunteerId, itemIndex) => {
        return itemIndex !== index && volunteerId;
      })
    );

    return volunteerOptions.filter(
      (volunteer) =>
        volunteer.id === memberVolunteerIds[index] ||
        !selectedIds.has(volunteer.id)
    );
  }

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
    const selectedVolunteerIds =
      normalizeSelectedVolunteerIds(memberVolunteerIds);

    if (hasDuplicateVolunteerIds(selectedVolunteerIds)) {
      setLoading(null);
      setFeedback({
        tone: "error",
        text: "No puedes seleccionar el mismo voluntario dos veces."
      });
      return;
    }

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
        volunteers: selectedVolunteerIds.map((volunteerId, index) => ({
          volunteerId,
          slotNumber: index + 1
        }))
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

  async function handleStatusOverride(status: "CONFIRMED" | "CANCELLED") {
    if (
      status === "CANCELLED" &&
      !window.confirm("Se cancelará esta asignación. ¿Deseas continuar?")
    ) {
      return;
    }

    const action = status === "CONFIRMED" ? "resolve" : "cancel";

    setLoading(action);
    setFeedback(null);

    const response = await fetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });
    const result = await response.json();

    setLoading(null);
    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? status === "CONFIRMED"
          ? "Asignación marcada como resuelta."
          : "Asignación cancelada."
        : result.error
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
          <p className="font-semibold">Overrides manuales</p>
          <p
            className={
              compact
                ? "text-xs text-muted-foreground"
                : "text-sm text-muted-foreground"
            }
          >
            Ajusta fecha, asigna suplente manualmente o cierra el seguimiento.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3">
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
              "rounded-lg border border-border/70 bg-background/35 text-muted-foreground",
              compact ? "px-4 py-2.5 text-sm" : "px-4 py-3 text-sm"
            )}
          >
            {DAY_LABELS[selectedDayOfWeek]}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="text-sm font-medium">Horario</label>
        <div className="grid grid-cols-2 gap-2">
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

      <div className="space-y-3">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Integrantes</label>
          <Button
            type="button"
            size={compact ? "sm" : "default"}
            variant="secondary"
            className="w-full gap-2"
            onClick={addMemberField}
            disabled={!canAddMemberField}
          >
            <Plus className="h-4 w-4" />
            Agregar integrante
          </Button>
        </div>
        <div className="grid gap-3">
          {memberVolunteerIds.map((volunteerId, index) => {
            const slotNumber = index + 1;
            const selectableVolunteers = getSelectableVolunteers(index);

            return (
              <div
                key={slotNumber}
                className="grid gap-2 rounded-lg border border-border/60 bg-background/35 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">
                    Integrante {slotNumber}
                  </label>
                  {memberVolunteerIds.length > MIN_VISIBLE_MEMBER_FIELDS ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => removeMemberField(index)}
                      aria-label={`Quitar integrante ${slotNumber}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Select
                  value={volunteerId || UNASSIGNED_VOLUNTEER_VALUE}
                  onValueChange={(nextValue) =>
                    setMemberVolunteerId(
                      index,
                      nextValue === UNASSIGNED_VOLUNTEER_VALUE ? "" : nextValue
                    )
                  }
                >
                  <SelectTrigger className={compact ? "h-10" : undefined}>
                    <SelectValue placeholder="Asignar voluntario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VOLUNTEER_VALUE}>
                      Sin asignar
                    </SelectItem>
                    {selectableVolunteers.map((volunteer) => (
                      <SelectItem key={volunteer.id} value={volunteer.id}>
                        {volunteer.name}
                        {volunteer.active ? "" : " (inactivo)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
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
        message={preflightWarnings.warningMessage}
        tone="warning"
      />

      <FeedbackMessage
        className={compact ? "text-xs" : undefined}
        message={feedback?.text}
        tone={feedback?.tone}
      />

      <div className="grid gap-2">
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          className="w-full"
          onClick={handleSave}
          disabled={
            loading !== null ||
            !assignmentDate ||
            !preachingPointId ||
            hasDuplicateVolunteerIds(memberVolunteerIds)
          }
        >
          {loading === "save" ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size={compact ? "sm" : "default"}
          className="w-full"
          onClick={() => handleStatusOverride("CONFIRMED")}
          disabled={loading !== null || assignment.status === "CONFIRMED"}
        >
          {loading === "resolve" ? "Marcando..." : "Marcar como resuelto"}
        </Button>
        <Button
          type="button"
          variant="danger"
          size={compact ? "sm" : "default"}
          className="w-full"
          onClick={() => handleStatusOverride("CANCELLED")}
          disabled={loading !== null || assignment.status === "CANCELLED"}
        >
          {loading === "cancel" ? "Cancelando..." : "Cancelar asignación"}
        </Button>
      </div>
    </div>
  );
}
