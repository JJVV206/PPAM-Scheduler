"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { TimeSlotOptionButton } from "@/components/assignments/time-slot-option-button";
import { cn } from "@/lib/utils";
import type {
  DayOfWeek,
  PreachingPointSummary,
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
  scheduleWeekId: string;
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

function getDayOfWeekFromDate(value: string): DayOfWeek {
  const date = new Date(`${value}T12:00:00`);
  return DAY_ORDER[date.getDay()];
}

function toAssignmentIsoDate(value: string) {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function AssignmentForm({
  scheduleWeekId,
  weekStartDate,
  preachingPoints,
  volunteers
}: AssignmentFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        weekDateOptions[0]?.value ?? format(new Date(), "yyyy-MM-dd"),
      timeSlot: "SLOT_09_11",
      preachingPointId: preachingPoints[0]?.id ?? "",
      notes: "",
      volunteerOneId: "",
      volunteerTwoId: ""
    }),
    [preachingPoints, scheduleWeekId, weekDateOptions]
  );

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const selectedDate = form.watch("assignmentDate");
  const selectedTimeSlot = form.watch("timeSlot");
  const selectedDayOfWeek = useMemo(
    () => getDayOfWeekFromDate(selectedDate),
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

  const hasSinglePoint = preachingPoints.length <= 1;

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
    setMessage(null);

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
      setMessage(result.error ?? "No fue posible crear la pareja asignada.");
      setSubmitting(false);
      return;
    }

    setMessage(
      `Pareja ${result.pairNumber} creada. Guarda de nuevo para agregar otra pareja al mismo punto y horario.`
    );
    form.reset({
      ...values,
      volunteerOneId: "",
      volunteerTwoId: "",
      notes: ""
    });
    router.refresh();
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">Agregar pareja</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[1080px] overflow-hidden p-5 sm:p-6">
        <DialogHeader className="space-y-1 pr-8">
          <DialogTitle>Agregar pareja al horario</DialogTitle>
          <DialogDescription>
            Cada guardado crea una pareja nueva para ese mismo horario.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  {compatiblePoints.length} punto
                  {compatiblePoints.length === 1 ? "" : "s"} compatible
                  {compatiblePoints.length === 1 ? "" : "s"} en este horario.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Los puntos sin slots activos siguen disponibles en cualquier
                  franja.
                </p>
              </div>
            </div>

            {!hasSinglePoint ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="preachingPointId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Punto de predicación</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selecciona un punto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {compatiblePoints.map((point) => (
                            <SelectItem key={point.id} value={point.id}>
                              {point.name} • {point.area}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

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

            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setOpen(false)}
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
