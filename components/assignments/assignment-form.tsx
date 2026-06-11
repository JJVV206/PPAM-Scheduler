"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { FeedbackMessage } from "@/components/ui/feedback-message";
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
  TIME_SLOT_DEFINITIONS,
  TIME_SLOTS
} from "@/lib/constants/domain";
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";
import { TimeSlotOptionButton } from "@/components/assignments/time-slot-option-button";
import { cn } from "@/lib/utils";
import type {
  DayOfWeek,
  PreachingPointSummary,
  TimeSlot,
  VolunteerSummary
} from "@/types/domain";

const assignmentFormSchema = z
  .object({
    scheduleWeekId: z.string().min(1),
    assignmentDate: z.string().min(1, "Selecciona una fecha."),
    timeSlot: z.enum(TIME_SLOTS),
    preachingPointId: z.string().min(1, "Selecciona un punto de predicación."),
    volunteerOneId: z.string().optional(),
    volunteerTwoId: z.string().optional(),
    notes: z.string().max(1000, "No excedas 1000 caracteres.").optional()
  })
  .refine(
    (values) =>
      !values.volunteerOneId ||
      !values.volunteerTwoId ||
      values.volunteerOneId !== values.volunteerTwoId,
    {
      message: "Selecciona dos voluntarios distintos para la pareja.",
      path: ["volunteerTwoId"]
    }
  );

type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

type AssignmentFormProps = {
  closeOnSuccess?: boolean;
  dialogDescription?: string;
  dialogTitle?: string;
  lockDateAndTime?: boolean;
  scheduleWeekId: string;
  presetAssignmentDate?: string;
  presetTimeSlot?: TimeSlot;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerSize?: ButtonProps["size"];
  weekStartDate: string;
  preachingPoints: PreachingPointSummary[];
  volunteers: VolunteerSummary[];
};

const DAY_ORDER: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY"
];
const SUCCESS_CLOSE_DELAY_MS = 900;

function getDayOfWeekFromDate(value: string): DayOfWeek {
  const date = new Date(`${value}T12:00:00`);
  return DAY_ORDER[date.getDay()];
}

function toAssignmentIsoDate(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function AssignmentForm({
  closeOnSuccess = true,
  dialogDescription = "Cada guardado crea una pareja nueva para ese mismo horario.",
  dialogTitle = "Agregar pareja al horario",
  lockDateAndTime = false,
  presetAssignmentDate,
  presetTimeSlot,
  scheduleWeekId,
  triggerClassName,
  triggerLabel = "Agregar pareja",
  triggerSize = "lg",
  weekStartDate,
  preachingPoints,
  volunteers
}: AssignmentFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  function clearCloseTimeout() {
    if (!closeTimeoutRef.current) return;
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
  }

  const weekDateOptions = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, index) => {
        const date = addDays(new Date(weekStartDate), index);
        return {
          value: format(date, "yyyy-MM-dd"),
          label: format(date, "EEEE d 'de' MMM", { locale: es }),
          shortLabel: format(date, "EEE d", { locale: es })
        };
      }),
    [weekStartDate]
  );

  const defaultValues = useMemo<AssignmentFormValues>(
    () => ({
      scheduleWeekId,
      assignmentDate:
        presetAssignmentDate ??
        weekDateOptions[0]?.value ??
        format(new Date(), "yyyy-MM-dd"),
      timeSlot: presetTimeSlot ?? "SLOT_09_11",
      preachingPointId: preachingPoints[0]?.id ?? "",
      notes: "",
      volunteerOneId: "",
      volunteerTwoId: ""
    }),
    [preachingPoints, presetAssignmentDate, presetTimeSlot, scheduleWeekId, weekDateOptions]
  );

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    return () => clearCloseTimeout();
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      clearCloseTimeout();
      setFeedback(null);
    }

    setOpen(nextOpen);
  }

  const selectedDate = form.watch("assignmentDate");
  const selectedTimeSlot = form.watch("timeSlot");
  const selectedDayOfWeek = useMemo(
    () => getDayOfWeekFromDate(selectedDate),
    [selectedDate]
  );
  const selectedDateLabel = useMemo(
    () =>
      format(new Date(`${selectedDate}T12:00:00`), "EEEE d 'de' MMM", {
        locale: es
      }),
    [selectedDate]
  );

  const compatiblePoints = useMemo(() => {
    const matches = preachingPoints.filter(
      (point) =>
        point.activeSlots.length === 0 ||
        point.activeSlots.some(
          (slot) =>
            slot.dayOfWeek === selectedDayOfWeek &&
            slot.timeSlot === selectedTimeSlot
        )
    );

    return matches.length ? matches : preachingPoints;
  }, [preachingPoints, selectedDayOfWeek, selectedTimeSlot]);

  useEffect(() => {
    const currentPointId = form.getValues("preachingPointId");
    if (
      compatiblePoints.length &&
      !compatiblePoints.some((point) => point.id === currentPointId)
    ) {
      form.setValue("preachingPointId", compatiblePoints[0].id, {
        shouldValidate: true
      });
    }
  }, [compatiblePoints, form]);

  async function onSubmit(values: AssignmentFormValues) {
    setSubmitting(true);
    setFeedback(null);

    const payload = {
      scheduleWeekId: values.scheduleWeekId,
      date: toAssignmentIsoDate(values.assignmentDate),
      dayOfWeek: selectedDayOfWeek,
      timeSlot: values.timeSlot,
      preachingPointId: values.preachingPointId,
      notes: values.notes,
      volunteers: [
        values.volunteerOneId
          ? { volunteerId: values.volunteerOneId, position: "FIRST" as const }
          : null,
        values.volunteerTwoId
          ? { volunteerId: values.volunteerTwoId, position: "SECOND" as const }
          : null
      ].filter(Boolean)
    };

    const response = await fetch("/api/assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result.error ?? "No fue posible crear la pareja asignada."
      });
      setSubmitting(false);
      return;
    }

    setFeedback({
      tone: "success",
      text: `Pareja ${result.pairNumber} creada. Cerrando ventana...`
    });
    form.reset({
      ...values,
      volunteerOneId: "",
      volunteerTwoId: "",
      notes: ""
    });
    router.refresh();
    if (closeOnSuccess) {
      clearCloseTimeout();
      closeTimeoutRef.current = window.setTimeout(() => {
        setOpen(false);
        setFeedback(null);
        closeTimeoutRef.current = null;
      }, SUCCESS_CLOSE_DELAY_MS);
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size={triggerSize}
          className={cn("w-full sm:w-auto", triggerClassName)}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[1080px] overflow-hidden p-5 sm:p-6">
        <DialogHeader className="space-y-1 pr-8">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {lockDateAndTime ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-primary/80">
                  Horario seleccionado
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/6 bg-background/25 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Día
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {DAY_LABELS[selectedDayOfWeek]}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/6 bg-background/25 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Fecha
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedDateLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/6 bg-background/25 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Franja
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {TIME_SLOT_DEFINITIONS[selectedTimeSlot].label}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Esta pareja quedará creada dentro de este mismo horario.
                </p>
              </div>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="assignmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de la semana</FormLabel>
                      <FormControl>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {weekDateOptions.map((option) => {
                            const isActive = field.value === option.value;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => field.onChange(option.value)}
                                className={cn(
                                  "rounded-2xl border px-4 py-2.5 text-left transition-colors",
                                  isActive
                                    ? "border-primary bg-primary/15 text-foreground shadow-[0_8px_24px_rgba(102,145,255,0.18)]"
                                    : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                )}
                              >
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  {option.shortLabel}
                                </p>
                                <p className="mt-1 text-[13px] font-semibold leading-snug text-inherit lg:text-sm">
                                  {option.label}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
                  <FormField
                    control={form.control}
                    name="timeSlot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horario</FormLabel>
                        <FormControl>
                          <div className="grid gap-2 sm:grid-cols-5">
                            {TIME_SLOTS.map((timeSlot) => {
                              const isActive = field.value === timeSlot;

                              return (
                                <TimeSlotOptionButton
                                  key={timeSlot}
                                  slot={timeSlot}
                                  selected={isActive}
                                  onClick={() => field.onChange(timeSlot)}
                                  dense
                                />
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Día
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {DAY_LABELS[selectedDayOfWeek]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Este horario se registrará en {FIXED_PREACHING_POINT_NAME}.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="volunteerOneId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voluntario 1</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Asignar primer voluntario" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {volunteers.map((volunteer) => (
                          <SelectItem key={volunteer.id} value={volunteer.id}>
                            {volunteer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volunteerTwoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voluntario 2</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Asignar segundo voluntario" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {volunteers.map((volunteer) => (
                          <SelectItem key={volunteer.id} value={volunteer.id}>
                            {volunteer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      className="min-h-[96px]"
                      placeholder="Indicaciones opcionales para esta pareja"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FeedbackMessage
              message={feedback?.text}
              tone={feedback?.tone}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
              >
                Cerrar
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Guardando..." : "Guardar pareja"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
