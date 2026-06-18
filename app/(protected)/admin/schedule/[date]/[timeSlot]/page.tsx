import Link from "next/link";
import { notFound } from "next/navigation";
import { startOfWeek } from "date-fns";
import { ArrowLeft, Clock3, Layers3, ShieldAlert } from "lucide-react";

import { AssignmentDetailContent } from "@/components/assignments/assignment-detail-content";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { EmptyState } from "@/components/forms/empty-state";
import { Button } from "@/components/ui/button";
import { TIME_SLOT_DEFINITIONS, TIME_SLOTS } from "@/lib/constants/domain";
import { db } from "@/lib/db/prisma";
import { formatDisplayDate } from "@/lib/utils";
import { getAssignmentsForScheduleSlot } from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";
import type { TimeSlot } from "@/types/domain";

type AdminScheduleSlotPageProps = {
  params: Promise<{ date: string; timeSlot: string }>;
};

function isValidTimeSlot(value: string): value is TimeSlot {
  return TIME_SLOTS.includes(value as TimeSlot);
}

export default async function AdminScheduleSlotPage({
  params
}: AdminScheduleSlotPageProps) {
  const { date, timeSlot } = await params;

  if (!isValidTimeSlot(timeSlot)) {
    notFound();
  }

  const slotDate = new Date(`${date}T12:00:00`);

  if (Number.isNaN(slotDate.getTime())) {
    notFound();
  }

  const [assignments, preachingPoints, volunteers, scheduleWeek] =
    await Promise.all([
      getAssignmentsForScheduleSlot({
        date: slotDate,
        timeSlot
      }),
      getPreachingPoints(),
      getVolunteers({ activeOnly: true }),
      db.scheduleWeek.findFirst({
        where: {
          startDate: { lte: slotDate },
          endDate: { gte: slotDate }
        }
      })
    ]);

  const weekStart = startOfWeek(slotDate, { weekStartsOn: 1 })
    .toISOString()
    .slice(0, 10);
  const attentionCount = assignments.filter(
    (assignment) => assignment.warnings.length > 0
  ).length;
  const pointCount = preachingPoints.length;
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
    <div className="flex min-h-full flex-col gap-5 pb-6 lg:h-full lg:min-h-0 lg:overflow-hidden lg:pb-0">
      <div className="sticky top-0 z-20 bg-background/85 pb-2 pt-1 backdrop-blur lg:static lg:shrink-0 lg:bg-transparent lg:pb-0 lg:pt-0 lg:backdrop-blur-none">
        <div className="surface-panel px-4 py-3">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/schedule?weekStart=${weekStart}`}>
                    <ArrowLeft className="h-4 w-4" />
                    Volver al horario
                  </Link>
                </Button>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-heading text-3xl font-semibold">
                      Horario {TIME_SLOT_DEFINITIONS[timeSlot].label}
                    </h1>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDisplayDate(slotDate, "EEEE d 'de' MMMM")} •{" "}
                    {assignments.length
                      ? `${assignments.length} pareja${
                          assignments.length === 1 ? "" : "s"
                        } registradas`
                      : "Sin parejas registradas todavía"}
                    {pointCount
                      ? ` • ${pointCount} punto${pointCount === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
              </div>

              {scheduleWeek ? (
                <div className="w-full xl:w-auto">
                  <AssignmentForm
                    dialogTitle="Agregar pareja a este horario"
                    dialogDescription="Cada guardado crea una nueva pareja dentro de este mismo día y horario."
                    lockDateAndTime
                    presetAssignmentDate={date}
                    presetTimeSlot={timeSlot}
                    scheduleWeekId={scheduleWeek.id}
                    triggerLabel="Agregar pareja a este horario"
                    weekStartDate={scheduleWeek.startDate
                      .toISOString()
                      .slice(0, 10)}
                    preachingPoints={formattedPoints}
                    volunteers={volunteers}
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-background/35 p-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <Layers3 className="h-3.5 w-3.5" />
                  Parejas
                </p>
                <p className="mt-2 font-heading text-3xl font-semibold">
                  {assignments.length}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/35 p-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Franja
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {TIME_SLOT_DEFINITIONS[timeSlot].label}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/35 p-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Atención
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {attentionCount
                    ? `${attentionCount} pareja${
                        attentionCount === 1 ? "" : "s"
                      } requieren seguimiento`
                    : "Todo al día"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/35 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Puntos activos
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {pointCount
                    ? `${pointCount} punto${pointCount === 1 ? "" : "s"}`
                    : "Sin puntos"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="surface-panel min-w-0 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Parejas del horario
          </p>
        </div>

        <div className="lg:min-h-0">
          {assignments.length ? (
            <div
              className={
                assignments.length > 1
                  ? "grid gap-4 xl:grid-cols-2"
                  : "space-y-4"
              }
            >
              {assignments.map((assignment) => (
                <section
                  key={assignment.id}
                  className="rounded-lg border border-border/60 bg-background/25 p-3 sm:p-4"
                >
                  <div className="mb-4 flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Pareja {assignment.pairNumber}
                      </p>
                      <h2 className="mt-1 font-heading text-2xl font-semibold">
                        {assignment.preachingPoint.name}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {assignment.preachingPoint.area}
                      </p>
                    </div>

                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/admin/assignments/${assignment.id}`}>
                        Abrir ficha completa
                      </Link>
                    </Button>
                  </div>

                  <AssignmentDetailContent
                    assignment={assignment}
                    compact
                    preachingPoints={formattedPoints}
                    volunteers={volunteers}
                  />
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sin parejas en este horario"
              description="Todavía no hay ninguna asignación registrada en esta franja. Usa el botón superior para crear la primera pareja de este horario."
            />
          )}
        </div>
      </div>
    </div>
  );
}
