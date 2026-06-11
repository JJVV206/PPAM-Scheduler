import { EmptyState } from "@/components/forms/empty-state";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { WeeklyScheduleGrid } from "@/components/schedule/weekly-schedule-grid";
import { ScheduleWeekToolbar } from "@/components/schedule/schedule-week-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWeeklySchedule } from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";
import { db } from "@/lib/db/prisma";

type AdminSchedulePageProps = {
  searchParams?: Promise<{
    weekStart?: string;
  }>;
};

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

  const [preachingPoints, volunteers, currentWeek, availableWeeks] =
    await Promise.all([
      getPreachingPoints(),
      getVolunteers(),
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
  const occupiedSlotCount = schedule.days.reduce(
    (total, day) =>
      total +
      Object.values(day.items).filter((items) => items.length > 0).length,
    0
  );
  const totalPairCount = schedule.days.reduce(
    (total, day) =>
      total +
      Object.values(day.items).reduce(
        (slotTotal, items) =>
          slotTotal +
          items.reduce((pairTotal, item) => pairTotal + item.pairs.length, 0),
        0
      ),
    0
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <section className="surface-panel shrink-0 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
              Horario semanal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {schedule.weekLabel}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2.5 xl:w-auto xl:items-end">
            <ScheduleWeekToolbar
              selectedWeekStart={schedule.startDate.toISOString().slice(0, 10)}
              availableWeeks={availableWeeks.map((week) => ({
                id: week.id,
                label: week.label,
                startDate: week.startDate.toISOString().slice(0, 10)
              }))}
            />

            {currentWeek ? (
              <div className="w-full xl:w-auto">
                <AssignmentForm
                  scheduleWeekId={currentWeek.id}
                  triggerClassName="xl:self-end"
                  triggerLabel="Agregar pareja"
                  triggerSize="default"
                  weekStartDate={schedule.startDate.toISOString()}
                  preachingPoints={formattedPoints}
                  volunteers={volunteers}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground xl:max-w-[30rem] xl:text-right">
                Primero crea o duplica la semana para habilitar asignaciones y
                seguimiento.
              </p>
            )}
          </div>
        </div>
      </section>

      <Card className="surface-panel min-h-0 flex-1 overflow-hidden">
        <CardHeader className="shrink-0 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Planeador</CardTitle>
              <p className="text-xs text-muted-foreground">
                Entra a cada horario para ver todas las parejas y abrir su ficha
                completa.
              </p>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {occupiedSlotCount} horario{occupiedSlotCount === 1 ? "" : "s"} con
              actividad • {totalPairCount} pareja
              {totalPairCount === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-0 sm:px-4 xl:px-5">
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
