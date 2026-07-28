"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { TimeSlotOptionButton } from "@/components/assignments/time-slot-option-button";
import { useAssignmentPreflightWarnings } from "@/components/assignments/use-assignment-preflight-warnings";
import { useEligibleVolunteers } from "@/components/assignments/use-eligible-volunteers";
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
import { getPpamDayOfWeek } from "@/lib/assignments/time";
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
  compact?: boolean;
  showDivider?: boolean;
  showHeading?: boolean;
};

function getDayOfWeekFromDate(value: string): DayOfWeek {
  return getPpamDayOfWeek(new Date(value + "T12:00:00.000Z"));
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
  const [knownVolunteers, setKnownVolunteers] = useState<VolunteerSummary[]>(
    () => assignment.volunteers.map((item) => item.volunteer)
  );
  const [notes, setNotes] = useState(assignment.notes ?? "");
  const [loading, setLoading] = useState<"save" | "resolve" | "cancel" | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const selectedMemberVolunteerIds = useMemo(
    () => normalizeSelectedVolunteerIds(memberVolunteerIds),
    [memberVolunteerIds]
  );
  const eligibleVolunteersQuery = useEligibleVolunteers({
    assignmentId: assignment.id,
    date: assignmentDate,
    timeSlot,
    enabled: true
  });
  const eligibleVolunteers = useMemo(
    () => eligibleVolunteersQuery.data?.volunteers ?? [],
    [eligibleVolunteersQuery.data]
  );
  const eligibleVolunteerIds = useMemo(
    () => new Set(eligibleVolunteers.map((volunteer) => volunteer.id)),
    [eligibleVolunteers]
  );

  useEffect(() => {
    if (!eligibleVolunteersQuery.data?.volunteers.length) return;

    setKnownVolunteers((current) => {
      const next = new Map(
        current.map((volunteer) => [volunteer.id, volunteer])
      );
      for (const volunteer of eligibleVolunteersQuery.data.volunteers) {
        next.set(volunteer.id, volunteer);
      }
      return [...next.values()];
    });
  }, [eligibleVolunteersQuery.data]);

  const volunteerOptions = useMemo(() => {
    const options = new Map(
      eligibleVolunteers.map((volunteer) => [volunteer.id, volunteer])
    );
    const knownById = new Map(
      knownVolunteers.map((volunteer) => [volunteer.id, volunteer])
    );

    for (const volunteerId of selectedMemberVolunteerIds) {
      const knownVolunteer = knownById.get(volunteerId);
      if (knownVolunteer) options.set(volunteerId, knownVolunteer);
    }

    return [...options.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "es-MX")
    );
  }, [eligibleVolunteers, knownVolunteers, selectedMemberVolunteerIds]);
  const canAddMemberField = memberVolunteerIds.length < volunteerOptions.length;
  const originalAssignmentDate = assignment.date.toISOString().slice(0, 10);
  const originalVolunteerIds = useMemo(
    () => new Set(assignment.volunteers.map((item) => item.volunteerId)),
    [assignment.volunteers]
  );
  const assignmentSlotChanged =
    assignmentDate !== originalAssignmentDate ||
    timeSlot !== assignment.timeSlot;
  const hasIneligibleSelection =
    eligibleVolunteersQuery.isSuccess &&
    selectedMemberVolunteerIds.some(
      (volunteerId) =>
        !eligibleVolunteerIds.has(volunteerId) &&
        (assignmentSlotChanged || !originalVolunteerIds.has(volunteerId))
    );

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
        (volunteer.id === memberVolunteerIds[index] ||
          eligibleVolunteerIds.has(volunteer.id)) &&
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

    if (eligibleVolunteersQuery.isFetching) {
      setLoading(null);
      setFeedback({
        tone: "error",
        text: "Espera a que termine la consulta de voluntarios disponibles."
      });
      return;
    }

    if (eligibleVolunteersQuery.isError) {
      setLoading(null);
      setFeedback({
        tone: "error",
        text: "No fue posible consultar los voluntarios disponibles. Inténtalo de nuevo."
      });
      return;
    }

    if (hasIneligibleSelection) {
      setLoading(null);
      setFeedback({
        tone: "error",
        text: "Quita los integrantes que ya no están disponibles para este horario."
      });
      return;
    }

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
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Integrantes</label>
            <span className="text-xs text-muted-foreground">
              {eligibleVolunteers.length} candidatos disponibles
            </span>
          </div>
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
                  disabled={eligibleVolunteersQuery.isFetching}
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
                        {!eligibleVolunteerIds.has(volunteer.id)
                          ? " (ya no disponible)"
                          : ""}
                        {volunteer.active ? "" : " (inactivo)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        {eligibleVolunteersQuery.isFetching ? (
          <p className="text-xs text-muted-foreground">
            Consultando voluntarios disponibles...
          </p>
        ) : null}
        {eligibleVolunteersQuery.isSuccess && !eligibleVolunteers.length ? (
          <p className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
            No hay voluntarios disponibles para este horario.
          </p>
        ) : null}
        {eligibleVolunteersQuery.isError ? (
          <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            No fue posible consultar los voluntarios disponibles.
          </p>
        ) : null}
        {hasIneligibleSelection ? (
          <p className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
            Hay un integrante seleccionado que no está disponible para el
            horario actual. Quita esa selección o cambia el horario.
          </p>
        ) : null}
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
            hasDuplicateVolunteerIds(memberVolunteerIds) ||
            eligibleVolunteersQuery.isFetching ||
            hasIneligibleSelection
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
