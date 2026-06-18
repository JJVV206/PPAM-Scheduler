import { format, startOfWeek } from "date-fns";

import { EmptyState } from "@/components/forms/empty-state";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { WeeklyScheduleGrid } from "@/components/schedule/weekly-schedule-grid";
import { ScheduleWeekToolbar } from "@/components/schedule/schedule-week-toolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getWeeklySchedule } from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";
import { db } from "@/lib/db/prisma";
import { formatDateRange } from "@/lib/utils";

type AdminSchedulePageProps = {
  searchParams?: Promise<{
    weekStart?: string;
  }>;
};

const scheduleStateLegend = [
  { label: "Titular pendiente", variant: "warning" as const },
  { label: "Confirmada", variant: "success" as const },
  { label: "Rechazada", variant: "danger" as const },
  { label: "Buscando suplente", variant: "danger" as const },
  { label: "Suplente invitado", variant: "default" as const },
  { label: "Cubierta por suplente", variant: "success" as const },
  { label: "Requiere atención", variant: "warning" as const }
];

export default async function AdminSchedulePage({
  searchParams
}: AdminSchedulePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedWeekStart = resolvedSearchParams?.weekStart
    ? new Date(`${resolvedSearchParams.weekStart}T12:00:00`)
    : new Date();
  const schedule = await getWeeklySchedule({
    weekStart: selectedWeekStart
  });
  const currentWeekStart = format(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
  const schedulePeriodLabel = formatDateRange(
    schedule.startDate,
    schedule.endDate
  );

  const [preachingPoints, volunteers, currentWeek, availableWeeks] =
    await Promise.all([
      getPreachingPoints(),
      getVolunteers({ activeOnly: true }),
      db.scheduleWeek.findFirst({
        where: {
          startDate: schedule.startDate
        }
      }),
      db.scheduleWeek.findMany({
        orderBy: {
          startDate: "desc"
        }
      })
    ]);
  const formattedPoints = preachingPoints.map((point) => ({
    id: point.id,
    name: point.name,
    area: point.area,
    notes: point.notes,
    active: point.active,
    activeSlots: point.activeSlots.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      timeSlot: slot.timeSlot
    }))
  }));
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <section className="surface-panel shrink-0 overflow-hidden px-4 py-3">
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(24rem,1fr)_auto] xl:items-start xl:gap-5">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold leading-tight sm:text-3xl lg:whitespace-nowrap">
              Horario semanal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {schedulePeriodLabel}
            </p>
            <div className="mt-3 flex max-w-full flex-wrap gap-1.5">
              {scheduleStateLegend.map((item) => (
                <Badge key={item.label} variant={item.variant}>
                  {item.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 xl:items-end">
            <ScheduleWeekToolbar
              selectedWeekStart={schedule.startDate.toISOString().slice(0, 10)}
              currentWeekStart={currentWeekStart}
              availableWeeks={availableWeeks.map((week) => ({
                id: week.id,
                label: week.label,
                startDate: week.startDate.toISOString().slice(0, 10)
              }))}
            />

            {currentWeek ? (
              <div className="w-full sm:w-auto xl:shrink-0">
                <AssignmentForm
                  scheduleWeekId={currentWeek.id}
                  triggerClassName="w-full sm:w-auto sm:whitespace-nowrap"
                  triggerLabel="Agregar pareja"
                  triggerSize="default"
                  weekStartDate={schedule.startDate.toISOString().slice(0, 10)}
                  preachingPoints={formattedPoints}
                  volunteers={volunteers}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <Card className="surface-panel min-h-0 flex-1 overflow-hidden">
        <CardContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-3">
          {schedule.days.some((day) =>
            Object.values(day.items).some((items) => items.length > 0)
          ) ? (
            <WeeklyScheduleGrid schedule={schedule} />
          ) : (
            <EmptyState
              title="Sin asignaciones todavía"
              description="Crea la primera asignación de esta semana para llenar el planeador."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
