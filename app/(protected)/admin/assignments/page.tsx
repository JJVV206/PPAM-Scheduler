import Link from "next/link";

import { AssignmentForm } from "@/components/assignments/assignment-form";
import { AssignmentGroupedList } from "@/components/assignments/assignment-grouped-list";
import { DataTable } from "@/components/forms/data-table";
import { EmptyState } from "@/components/forms/empty-state";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/prisma";
import {
  getAssignments,
  getWeeklySchedule
} from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";

export default async function AdminAssignmentsPage() {
  const schedule = await getWeeklySchedule();

  const [assignments, preachingPoints, volunteers, currentWeek] =
    await Promise.all([
      getAssignments(),
      getPreachingPoints(),
      getVolunteers({ activeOnly: true }),
      db.scheduleWeek.findFirst({
        where: {
          startDate: schedule.startDate
        }
      })
    ]);

  const mappedPreachingPoints = preachingPoints.map((point) => ({
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
    <DataTable
      title="Asignaciones"
      description="Todas las asignaciones programadas, pendientes, con reemplazo y completadas."
      actions={
        currentWeek ? (
          <AssignmentForm
            closeOnSuccess
            scheduleWeekId={currentWeek.id}
            weekStartDate={schedule.startDate.toISOString().slice(0, 10)}
            preachingPoints={mappedPreachingPoints}
            volunteers={volunteers}
          />
        ) : (
          <Button asChild>
            <Link href="/admin/schedule">Preparar semana primero</Link>
          </Button>
        )
      }
    >
      {assignments.length ? (
        <AssignmentGroupedList
          assignments={assignments}
          preachingPoints={mappedPreachingPoints}
          volunteers={volunteers}
        />
      ) : (
        <EmptyState
          title="Sin asignaciones"
          description="Crea una pareja desde el horario semanal para empezar a organizar esta lista por día."
        />
      )}
    </DataTable>
  );
}
