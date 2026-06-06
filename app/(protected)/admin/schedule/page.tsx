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

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <div className="shrink-0 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-heading text-4xl font-semibold">
            Horario semanal
          </h1>
          <p className="text-sm text-muted-foreground">{schedule.weekLabel}</p>
        </div>
        <ScheduleWeekToolbar
          selectedWeekStart={schedule.startDate.toISOString().slice(0, 10)}
          availableWeeks={availableWeeks.map((week) => ({
            id: week.id,
            label: week.label,
            startDate: week.startDate.toISOString().slice(0, 10)
          }))}
        />
      </div>

      {currentWeek ? (
        <AssignmentForm
          scheduleWeekId={currentWeek.id}
          weekStartDate={schedule.startDate.toISOString()}
          preachingPoints={preachingPoints.map((point) => ({
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
          }))}
          volunteers={volunteers}
        />
      ) : (
        <Card className="surface-panel shrink-0">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Esta semana todavía no existe como registro operativo. Usa{" "}
            <span className="font-medium text-foreground">
              Crear o duplicar semana
            </span>{" "}
            para habilitar asignaciones y seguimiento.
          </CardContent>
        </Card>
      )}

      <Card className="surface-panel min-h-0 flex-1 overflow-hidden">
        <CardHeader className="shrink-0 p-4 pb-3 xl:px-5 xl:pt-5">
          <CardTitle>Planeador</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-2 pt-0 xl:px-5">
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
