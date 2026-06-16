"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Textarea } from "@/components/ui/textarea";
import {
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS,
  TIME_SLOTS
} from "@/lib/constants/domain";
import { cn } from "@/lib/utils";
import type { DayOfWeek, TimeSlot } from "@/types/domain";

type ReplacementCensusFormProps = {
  title?: string;
  description?: string;
  submitUrl: string;
  method?: "POST" | "PATCH";
  weekDays: Array<{
    date: string;
    dayOfWeek: DayOfWeek;
  }>;
  initialAvailability?: Array<{
    date: string;
    dayOfWeek: DayOfWeek;
    timeSlot?: TimeSlot | null;
    available: boolean;
    notes?: string | null;
  }>;
  compact?: boolean;
  onSaved?: () => void;
};

type DayFormState = {
  available: boolean;
  useSpecificSlots: boolean;
  timeSlots: Set<TimeSlot>;
  notes: string;
  expanded: boolean;
};

function buildInitialState(
  weekDays: ReplacementCensusFormProps["weekDays"],
  initialAvailability: NonNullable<
    ReplacementCensusFormProps["initialAvailability"]
  >
) {
  const grouped = new Map<string, typeof initialAvailability>();

  for (const item of initialAvailability) {
    const dateKey = item.date.slice(0, 10);
    grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), item]);
  }

  return Object.fromEntries(
    weekDays.map((day) => {
      const rows = grouped.get(day.date) ?? [];
      const availableRows = rows.filter((row) => row.available);
      const specificSlots = availableRows
        .map((row) => row.timeSlot)
        .filter((timeSlot): timeSlot is TimeSlot => Boolean(timeSlot));
      const notes = rows.find((row) => row.notes)?.notes ?? "";

      return [
        day.date,
        {
          available: availableRows.length > 0,
          useSpecificSlots: specificSlots.length > 0,
          timeSlots: new Set(specificSlots),
          notes,
          expanded: availableRows.length > 0 || notes.length > 0
        }
      ];
    })
  ) as Record<string, DayFormState>;
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

export function ReplacementCensusForm({
  title = "Disponibilidad semanal",
  description = "Marca los días disponibles. Puedes dejar un día como disponible general o elegir horarios específicos.",
  submitUrl,
  method = "POST",
  weekDays,
  initialAvailability = [],
  compact = false,
  onSaved
}: ReplacementCensusFormProps) {
  const router = useRouter();
  const [days, setDays] = useState<Record<string, DayFormState>>(() =>
    buildInitialState(weekDays, initialAvailability)
  );
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const availableCount = useMemo(
    () => Object.values(days).filter((day) => day.available).length,
    [days]
  );

  function updateDay(dateKey: string, next: Partial<DayFormState>) {
    setDays((current) => ({
      ...current,
      [dateKey]: {
        ...current[dateKey],
        ...next
      }
    }));
  }

  function toggleTimeSlot(dateKey: string, timeSlot: TimeSlot, checked: boolean) {
    setDays((current) => {
      const nextSlots = new Set(current[dateKey].timeSlots);
      if (checked) {
        nextSlots.add(timeSlot);
      } else {
        nextSlots.delete(timeSlot);
      }

      return {
        ...current,
        [dateKey]: {
          ...current[dateKey],
          timeSlots: nextSlots
        }
      };
    });
  }

  async function save() {
    setSubmitting(true);
    setFeedback(null);

    const response = await fetch(submitUrl, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        days: weekDays.map((day) => {
          const state = days[day.date];

          return {
            date: parseDateKey(day.date).toISOString(),
            dayOfWeek: day.dayOfWeek,
            available: state.available,
            timeSlots:
              state.available && state.useSpecificSlots
                ? Array.from(state.timeSlots)
                : [],
            notes: state.notes.trim() || undefined
          };
        })
      })
    });
    const result = await response.json();

    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? "Disponibilidad semanal guardada."
        : result.error ?? "No fue posible guardar la disponibilidad."
    });
    setCompleted(response.ok);
    setSubmitting(false);

    if (response.ok) {
      onSaved?.();
      router.refresh();
    }
  }

  return (
    <Card className="surface-elevated">
      <CardContent className={cn("space-y-5", compact ? "p-4" : "p-6")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="font-heading text-2xl font-semibold">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            {availableCount} de 7 días disponibles
          </div>
        </div>

        <div className="grid gap-3">
          {weekDays.map((day) => {
            const state = days[day.date];
            const dateLabel = format(parseDateKey(day.date), "d 'de' MMMM", {
              locale: es
            });

            return (
              <div
                key={day.date}
                className="rounded-2xl border border-border/70 bg-background/35 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-2 text-left"
                    onClick={() =>
                      updateDay(day.date, { expanded: !state.expanded })
                    }
                  >
                    {state.expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      <span className="block font-semibold">
                        {DAY_LABELS[day.dayOfWeek]}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {dateLabel}
                      </span>
                    </span>
                  </button>

                  <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/50 px-3 py-2 text-sm">
                    <Checkbox
                      checked={state.available}
                      onCheckedChange={(checked) =>
                        updateDay(day.date, {
                          available: checked === true,
                          expanded: checked === true || state.expanded
                        })
                      }
                    />
                    Disponible este día
                  </label>
                </div>

                {state.expanded ? (
                  <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                    {state.available ? (
                      <>
                        <label className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={state.useSpecificSlots}
                            onCheckedChange={(checked) =>
                              updateDay(day.date, {
                                useSpecificSlots: checked === true
                              })
                            }
                          />
                          Indicar horarios específicos
                        </label>

                        {state.useSpecificSlots ? (
                          <div className="grid gap-2 sm:grid-cols-5">
                            {TIME_SLOTS.map((timeSlot) => (
                              <label
                                key={timeSlot}
                                className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/40 px-3 py-2 text-sm"
                              >
                                <Checkbox
                                  checked={state.timeSlots.has(timeSlot)}
                                  onCheckedChange={(checked) =>
                                    toggleTimeSlot(
                                      day.date,
                                      timeSlot,
                                      checked === true
                                    )
                                  }
                                />
                                {TIME_SLOT_DEFINITIONS[timeSlot].shortLabel}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-2xl bg-primary/10 px-3 py-2 text-sm text-primary">
                            Disponible en general durante este día.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="rounded-2xl bg-background/50 px-3 py-2 text-sm text-muted-foreground">
                        Quedará registrado como no disponible para este día.
                      </p>
                    )}

                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Nota opcional
                      </label>
                      <Textarea
                        value={state.notes}
                        onChange={(event) =>
                          updateDay(day.date, { notes: event.target.value })
                        }
                        rows={compact ? 2 : 3}
                        placeholder="Comentario breve para el administrador."
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          className="w-full"
          size={compact ? "default" : "lg"}
          onClick={save}
          disabled={submitting || completed}
        >
          <CheckCircle2 className="h-4 w-4" />
          {submitting ? "Guardando..." : "Guardar disponibilidad"}
        </Button>
        <FeedbackMessage
          message={feedback?.text}
          tone={feedback?.tone}
          className="justify-center text-center"
        />
      </CardContent>
    </Card>
  );
}
