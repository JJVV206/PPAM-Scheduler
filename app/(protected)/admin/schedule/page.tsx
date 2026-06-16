import { format, isSameMonth, isSameYear, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

import { EmptyState } from "@/components/forms/empty-state";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { WeeklyScheduleGrid } from "@/components/schedule/weekly-schedule-grid";
import { ScheduleWeekToolbar } from "@/components/schedule/schedule-week-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { getWeeklySchedule } from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";
import { db } from "@/lib/db/prisma";

type AdminSchedulePageProps = {
  searchParams?: Promise<{
    weekStart?: string;
  }>;
};

function formatSchedulePeriod(startDate: Date, endDate: Date) {
  if (isSameMonth(startDate, endDate) && isSameYear(startDate, endDate)) {
    return `Del ${format(startDate, "d", { locale: es })} al ${format(
      endDate,
      "d 'de' MMMM 'de' yyyy",
      { locale: es }
    )}`;
  }

  if (isSameYear(startDate, endDate)) {
    return `Del ${format(startDate, "d 'de' MMMM", {
      locale: es
    })} al ${format(endDate, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  }

  return `Del ${format(startDate, "d 'de' MMMM 'de' yyyy", {
    locale: es
  })} al ${format(endDate, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
}

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
  const schedulePeriodLabel = formatSchedulePeriod(
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
      <section className="surface-panel shrink-0 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 xl:shrink-0">
            <h1 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl lg:whitespace-nowrap">
              Horario semanal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {schedulePeriodLabel}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2.5 xl:w-auto xl:flex-row xl:items-center xl:justify-end">
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
              <div className="w-full xl:w-auto xl:shrink-0">
                <AssignmentForm
                  scheduleWeekId={currentWeek.id}
                  triggerClassName="xl:whitespace-nowrap"
                  triggerLabel="Agregar pareja"
                  triggerSize="default"
                  weekStartDate={schedule.startDate.toISOString().slice(0, 10)}
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
        <CardContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 xl:p-5">
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
