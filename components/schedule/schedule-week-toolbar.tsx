"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, startOfWeek } from "date-fns";
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
  recommendedTargetWeekStart: string;
  recommendedSourceWeekId: string | null;
  availableWeeks: Array<{
    id: string;
    label: string;
    startDate: string;
  }>;
};

type CreationMode = "EMPTY" | "DUPLICATE";

type WeekPreparationSummary = {
  assignmentCount?: number;
  primaryInvitations?: {
    sentCount: number;
    failedCount: number;
  };
  replacementCensus?: {
    censusId: string;
    replacementCount: number;
    createdResponseCount: number;
    skippedResponseCount: number;
    sentCount: number;
    failedCount: number;
  };
  automation?: {
    assignmentCount: number;
    primaryInvitations: {
      sentCount: number;
      failedCount: number;
    };
    replacementCensus: {
      censusId: string;
      replacementCount: number;
      createdResponseCount: number;
      skippedResponseCount: number;
      sentCount: number;
      failedCount: number;
    };
  };
};

function toIsoWeekStart(value: string) {
  return new Date(`${getWeekStartValue(value)}T12:00:00`).toISOString();
}

function getWeekStartValue(value: string) {
  return format(
    startOfWeek(new Date(`${value}T12:00:00`), { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
}

function buildPreparationFeedback(
  result: WeekPreparationSummary,
  mode: CreationMode
) {
  const assignmentCount =
    result.assignmentCount ?? result.automation?.assignmentCount ?? 0;
  const primaryInvitations =
    result.primaryInvitations ?? result.automation?.primaryInvitations;
  const replacementCensus =
    result.replacementCensus ?? result.automation?.replacementCensus;
  const parts = [
    mode === "EMPTY" ? "Semana creada" : "Semana duplicada",
    `Asignaciones creadas: ${assignmentCount}`
  ];

  if (primaryInvitations) {
    parts.push(`Titulares notificados: ${primaryInvitations.sentCount}`);

    if (primaryInvitations.failedCount) {
      parts.push(`Titulares fallidos: ${primaryInvitations.failedCount}`);
    }
  }

  if (replacementCensus) {
    const pendingCount = Math.max(
      replacementCensus.createdResponseCount +
        replacementCensus.skippedResponseCount -
        replacementCensus.sentCount -
        replacementCensus.failedCount,
      0
    );

    parts.push("Censo de suplentes abierto");
    parts.push(`Suplentes consultados: ${replacementCensus.replacementCount}`);
    parts.push(`Pendientes: ${pendingCount}`);

    if (replacementCensus.failedCount) {
      parts.push(`Emails de censo fallidos: ${replacementCensus.failedCount}`);
    }
  }

  return `${parts.join(" · ")}.`;
}

export function ScheduleWeekToolbar({
  currentWeekStart,
  selectedWeekStart,
  recommendedTargetWeekStart,
  recommendedSourceWeekId,
  availableWeeks
}: ScheduleWeekToolbarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CreationMode>(
    availableWeeks.length ? "DUPLICATE" : "EMPTY"
  );
  const [targetWeekStart, setTargetWeekStart] = useState(
    recommendedTargetWeekStart
  );
  const [sourceWeekId, setSourceWeekId] = useState(
    recommendedSourceWeekId ?? availableWeeks[0]?.id ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;

    setTargetWeekStart(recommendedTargetWeekStart);
    setSourceWeekId(recommendedSourceWeekId ?? availableWeeks[0]?.id ?? "");
    setFeedback(null);
  }, [
    availableWeeks,
    open,
    recommendedSourceWeekId,
    recommendedTargetWeekStart
  ]);

  useEffect(() => {
    if (sourceWeekId || !recommendedSourceWeekId) {
      return;
    }

    setSourceWeekId(recommendedSourceWeekId);
  }, [recommendedSourceWeekId, sourceWeekId]);

  const viewingCurrentWeek = selectedWeekStart === currentWeekStart;
  const existingWeekStarts = new Set(
    availableWeeks.map((week) => getWeekStartValue(week.startDate))
  );
  const normalizedTargetWeekStart = targetWeekStart
    ? getWeekStartValue(targetWeekStart)
    : "";
  const targetWeekExists = normalizedTargetWeekStart
    ? existingWeekStarts.has(normalizedTargetWeekStart)
    : false;
  const recommendedSourceIdForTarget =
    availableWeeks.find(
      (week) => getWeekStartValue(week.startDate) < normalizedTargetWeekStart
    )?.id ??
    recommendedSourceWeekId ??
    availableWeeks[0]?.id ??
    "";

  function navigateToWeek(value: string) {
    router.push(`/admin/schedule?weekStart=${value}`);
  }

  async function handleSubmit() {
    if (targetWeekExists) {
      setFeedback({
        tone: "warning",
        text: `Ya existe una semana creada para el ${format(
          new Date(`${normalizedTargetWeekStart}T12:00:00`),
          "dd/MM/yyyy"
        )}.`
      });
      return;
    }

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
      text: buildPreparationFeedback(result, mode)
    });
    setSubmitting(false);
    setOpen(false);
    router.push(`/admin/schedule?weekStart=${normalizedTargetWeekStart}`);
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
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
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
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
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
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
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setTargetWeekStart(nextValue);
                  setFeedback(null);

                  if (!nextValue) {
                    return;
                  }

                  const nextWeekStart = getWeekStartValue(nextValue);
                  const nextRecommendedSourceId =
                    availableWeeks.find(
                      (week) => getWeekStartValue(week.startDate) < nextWeekStart
                    )?.id ?? "";

                  if (nextRecommendedSourceId) {
                    setSourceWeekId(nextRecommendedSourceId);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                El sistema tomará el lunes de esta fecha. Vista previa:{" "}
                {normalizedTargetWeekStart
                  ? format(
                      new Date(`${normalizedTargetWeekStart}T12:00:00`),
                      "EEEE d 'de' MMMM",
                      {
                        locale: es
                      }
                    )
                  : "selecciona una fecha"}
              </p>
            </div>

            {targetWeekExists ? (
              <FeedbackMessage
                tone="warning"
                message={`Ya existe una semana creada para el ${format(
                  new Date(`${normalizedTargetWeekStart}T12:00:00`),
                  "dd/MM/yyyy"
                )}. Elige otro lunes para evitar duplicados.`}
              />
            ) : null}

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
                        {week.id === recommendedSourceIdForTarget
                          ? " • recomendada"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Al duplicar se crearán invitaciones nuevas y se enviarán
                  emails de designación y el censo de suplentes para la semana
                  destino.
                </p>
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
                  targetWeekExists ||
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
      {!open && feedback ? (
        <div className="w-full lg:basis-full">
          <FeedbackMessage message={feedback.text} tone={feedback.tone} />
        </div>
      ) : null}
    </div>
  );
}
