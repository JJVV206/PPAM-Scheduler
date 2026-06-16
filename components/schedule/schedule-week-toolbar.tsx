"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  CalendarPlus2,
  CopyPlus,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type ScheduleWeekToolbarProps = {
  currentWeekStart: string;
  selectedWeekStart: string;
  availableWeeks: Array<{
    id: string;
    label: string;
    startDate: string;
  }>;
};

type CreationMode = "EMPTY" | "DUPLICATE";

function toIsoWeekStart(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function ScheduleWeekToolbar({
  currentWeekStart,
  selectedWeekStart,
  availableWeeks
}: ScheduleWeekToolbarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CreationMode>(
    availableWeeks.length ? "DUPLICATE" : "EMPTY"
  );
  const [targetWeekStart, setTargetWeekStart] = useState(selectedWeekStart);
  const [sourceWeekId, setSourceWeekId] = useState(availableWeeks[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setTargetWeekStart(selectedWeekStart);
  }, [selectedWeekStart]);

  useEffect(() => {
    if (!sourceWeekId && availableWeeks[0]?.id) {
      setSourceWeekId(availableWeeks[0].id);
    }
  }, [availableWeeks, sourceWeekId]);

  const viewingCurrentWeek = selectedWeekStart === currentWeekStart;

  function navigateToWeek(value: string) {
    router.push(`/admin/schedule?weekStart=${value}`);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setFeedback(null);

    const endpoint =
      mode === "EMPTY" ? "/api/schedule/week" : "/api/schedule/duplicate";
    const body =
      mode === "EMPTY"
        ? {
            targetWeekStart: toIsoWeekStart(targetWeekStart)
          }
        : {
            sourceWeekId,
            targetWeekStart: toIsoWeekStart(targetWeekStart)
          };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const result = await response.json();

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result.error ?? "No fue posible preparar la semana."
      });
      setSubmitting(false);
      return;
    }

    setFeedback({
      tone: "success",
      text:
        mode === "EMPTY" ? "Semana creada." : "Semana duplicada correctamente."
    });
    setSubmitting(false);
    setOpen(false);
    router.push(`/admin/schedule?weekStart=${targetWeekStart}`);
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="grid w-full min-w-0 gap-2 sm:grid-cols-3 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:min-w-0 lg:w-auto"
          onClick={() =>
            navigateToWeek(
              format(
                addDays(new Date(`${selectedWeekStart}T12:00:00`), -7),
                "yyyy-MM-dd"
              )
            )
          }
        >
          <ChevronLeft className="h-4 w-4" />
          Semana anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-current={viewingCurrentWeek ? "date" : undefined}
          className="w-full sm:min-w-0 lg:w-auto"
          onClick={() => navigateToWeek(currentWeekStart)}
        >
          <CalendarDays className="h-4 w-4" />
          Esta semana
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:min-w-0 lg:w-auto"
          onClick={() =>
            navigateToWeek(
              format(
                addDays(new Date(`${selectedWeekStart}T12:00:00`), 7),
                "yyyy-MM-dd"
              )
            )
          }
        >
          Semana siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto xl:whitespace-nowrap">
            <CalendarPlus2 className="h-4 w-4" />
            Crear o duplicar semana
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Preparar semana</DialogTitle>
            <DialogDescription>
              Crea una semana vacía o duplica una existente para dejar el
              planner listo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-2">
              <Label>Modo</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("EMPTY")}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                    mode === "EMPTY"
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border/70 bg-background/35 text-muted-foreground"
                  }`}
                >
                  <p className="font-semibold">Semana vacía</p>
                  <p className="mt-1 text-sm text-inherit">
                    Solo crea el rango y permite asignar desde cero.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("DUPLICATE")}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                    mode === "DUPLICATE"
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border/70 bg-background/35 text-muted-foreground"
                  }`}
                  disabled={!availableWeeks.length}
                >
                  <p className="flex items-center gap-2 font-semibold">
                    <CopyPlus className="h-4 w-4" />
                    Duplicar semana
                  </p>
                  <p className="mt-1 text-sm text-inherit">
                    Reutiliza parejas y puntos ya preparados.
                  </p>
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="targetWeekStart">
                Inicio de la semana destino
              </Label>
              <Input
                id="targetWeekStart"
                type="date"
                value={targetWeekStart}
                onChange={(event) => setTargetWeekStart(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El sistema tomará el lunes de esta fecha. Vista previa:{" "}
                {format(
                  new Date(`${targetWeekStart}T12:00:00`),
                  "EEEE d 'de' MMMM",
                  {
                    locale: es
                  }
                )}
              </p>
            </div>

            {mode === "DUPLICATE" ? (
              <div className="grid gap-2">
                <Label>Semana origen</Label>
                <Select value={sourceWeekId} onValueChange={setSourceWeekId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una semana" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWeeks.map((week) => (
                      <SelectItem key={week.id} value={week.id}>
                        {week.label} •{" "}
                        {format(new Date(week.startDate), "d 'de' MMM", {
                          locale: es
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !targetWeekStart ||
                  (mode === "DUPLICATE" && !sourceWeekId)
                }
              >
                {submitting
                  ? "Preparando..."
                  : mode === "EMPTY"
                    ? "Crear semana"
                    : "Duplicar semana"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
