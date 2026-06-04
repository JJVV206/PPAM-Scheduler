"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS,
  TIME_SLOTS
} from "@/lib/constants/domain";
import type { DayOfWeek, TimeSlot } from "@/types/domain";

type AvailabilitySelectorProps = {
  volunteerId: string;
  initialAvailability: Array<{
    dayOfWeek: DayOfWeek;
    timeSlot: TimeSlot;
  }>;
  initialTemporaryUnavailable: boolean;
  initialExceptions: Array<{
    id: string;
    startDate: string;
    endDate: string;
    reason?: string | null;
  }>;
};

type AvailabilityExceptionForm = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
};

function createEmptyException(): AvailabilityExceptionForm {
  return {
    id: crypto.randomUUID(),
    startDate: "",
    endDate: "",
    reason: ""
  };
}

function toIsoBoundary(date: string, boundary: "start" | "end") {
  const time = boundary === "start" ? "00:00:00" : "23:59:59";
  return new Date(`${date}T${time}`).toISOString();
}

export function AvailabilitySelector({
  volunteerId,
  initialAvailability,
  initialTemporaryUnavailable,
  initialExceptions
}: AvailabilitySelectorProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(
    new Set(
      initialAvailability.map((item) => `${item.dayOfWeek}:${item.timeSlot}`)
    )
  );
  const [temporaryUnavailable, setTemporaryUnavailable] = useState(
    initialTemporaryUnavailable
  );
  const [exceptions, setExceptions] = useState<AvailabilityExceptionForm[]>(
    initialExceptions.map((item) => ({
      id: item.id,
      startDate: item.startDate,
      endDate: item.endDate,
      reason: item.reason ?? ""
    }))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(dayOfWeek: DayOfWeek, timeSlot: TimeSlot, checked: boolean) {
    const next = new Set(selected);
    const key = `${dayOfWeek}:${timeSlot}`;
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    setSelected(next);
  }

  function updateException(
    exceptionId: string,
    field: keyof Omit<AvailabilityExceptionForm, "id">,
    value: string
  ) {
    setExceptions((current) =>
      current.map((item) =>
        item.id === exceptionId ? { ...item, [field]: value } : item
      )
    );
  }

  function removeException(exceptionId: string) {
    setExceptions((current) =>
      current.filter((item) => item.id !== exceptionId)
    );
  }

  async function save() {
    setSubmitting(true);
    setMessage(null);

    const items = Array.from(selected).map((item) => {
      const [dayOfWeek, timeSlot] = item.split(":") as [DayOfWeek, TimeSlot];
      return {
        dayOfWeek,
        timeSlot,
        available: true,
        recurring: true
      };
    });

    const response = await fetch("/api/availability", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        volunteerId,
        items,
        temporaryUnavailable,
        exceptions: exceptions
          .filter((item) => item.startDate && item.endDate)
          .map((item) => ({
            startDate: toIsoBoundary(item.startDate, "start"),
            endDate: toIsoBoundary(item.endDate, "end"),
            reason: item.reason || undefined
          }))
      })
    });

    const result = await response.json();
    setMessage(response.ok ? "Disponibilidad actualizada." : result.error);
    setSubmitting(false);

    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.45fr,1fr]">
      <Card className="surface-panel">
        <CardContent className="space-y-5 p-6">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="rounded-2xl bg-white/[0.03] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{DAY_LABELS[day]}</p>
                  <p className="text-sm text-muted-foreground">
                    Preferencia semanal recurrente
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                {TIME_SLOTS.map((timeSlot) => {
                  const key = `${day}:${timeSlot}`;
                  return (
                    <label
                      key={timeSlot}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/30 px-4 py-3"
                    >
                      <Checkbox
                        checked={selected.has(key)}
                        onCheckedChange={(checked) =>
                          toggle(day, timeSlot, checked === true)
                        }
                      />
                      <span className="text-sm">
                        {TIME_SLOT_DEFINITIONS[timeSlot].shortLabel}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card className="surface-elevated h-fit">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <p className="font-heading text-xl font-semibold">
                Controles de disponibilidad
              </p>
              <p className="text-sm text-muted-foreground">
                Las excepciones alimentan el filtrado de sugerencias y
                reemplazos futuros.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-background/40 p-4">
              <div>
                <p className="font-medium">No disponible temporalmente</p>
                <p className="text-sm text-muted-foreground">
                  Pausar sugerencias de asignación
                </p>
              </div>
              <Switch
                checked={temporaryUnavailable}
                onCheckedChange={setTemporaryUnavailable}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="surface-elevated">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-heading text-xl font-semibold">
                  Excepciones temporales
                </p>
                <p className="text-sm text-muted-foreground">
                  Bloques concretos de días donde no podrás servir.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setExceptions((current) => [
                    ...current,
                    createEmptyException()
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Agregar bloque
              </Button>
            </div>

            {exceptions.length ? (
              <div className="space-y-3">
                {exceptions.map((exception) => (
                  <div
                    key={exception.id}
                    className="rounded-2xl border border-border/70 bg-background/35 p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-[1fr,1fr,1.3fr,auto] md:items-end">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Desde</label>
                        <Input
                          type="date"
                          value={exception.startDate}
                          onChange={(event) =>
                            updateException(
                              exception.id,
                              "startDate",
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Hasta</label>
                        <Input
                          type="date"
                          value={exception.endDate}
                          onChange={(event) =>
                            updateException(
                              exception.id,
                              "endDate",
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Motivo</label>
                        <Input
                          value={exception.reason}
                          onChange={(event) =>
                            updateException(
                              exception.id,
                              "reason",
                              event.target.value
                            )
                          }
                          placeholder="Viaje, enfermedad, imprevisto..."
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeException(exception.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/25 px-4 py-6 text-sm text-muted-foreground">
                No hay excepciones registradas. Tus horarios recurrentes
                seguirán siendo la única referencia operativa.
              </div>
            )}

            <div className="bg-primary/8 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
              {exceptions.length && exceptions[exceptions.length - 1]?.startDate
                ? `Última excepción cargada: ${format(
                    new Date(
                      `${exceptions[exceptions.length - 1]?.startDate}T12:00:00`
                    ),
                    "d 'de' MMMM"
                  )}.`
                : "Las excepciones afectan las sugerencias de vacantes y reemplazos para esas fechas."}
            </div>

            <Button className="w-full" onClick={save} disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar preferencias"}
            </Button>
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
