import Link from "next/link";

import { AssignmentForm } from "@/components/assignments/assignment-form";
import { AssignmentDetailModal } from "@/components/assignments/assignment-detail-modal";
import { StatusBadge } from "@/components/assignments/status-badge";
import { DataTable } from "@/components/forms/data-table";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { db } from "@/lib/db/prisma";
import { formatDisplayDate } from "@/lib/utils";
import { getAssignments, getWeeklySchedule } from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";

export default async function AdminAssignmentsPage() {
  const schedule = await getWeeklySchedule();

  const [assignments, preachingPoints, volunteers, currentWeek] = await Promise.all([
    getAssignments(),
    getPreachingPoints(),
    getVolunteers(),
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
            scheduleWeekId={currentWeek.id}
            weekStartDate={schedule.startDate.toISOString()}
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Punto</TableHead>
            <TableHead>Pareja</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell>
                {formatDisplayDate(assignment.date, "EEE d 'de' MMM")}
              </TableCell>
              <TableCell>
                {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
              </TableCell>
              <TableCell>{assignment.preachingPoint.name}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Pareja {assignment.pairNumber}
                  </p>
                  <p>
                    {assignment.volunteers
                      .map((item) => item.volunteer.name)
                      .join(" y ")}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={assignment.status} />
              </TableCell>
              <TableCell className="text-right">
                <AssignmentDetailModal
                  assignment={assignment}
                  preachingPoints={mappedPreachingPoints}
                  volunteers={volunteers}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTable>
  );
}
