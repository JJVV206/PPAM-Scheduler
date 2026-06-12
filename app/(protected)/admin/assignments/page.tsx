import Link from "next/link";

import { AssignmentForm } from "@/components/assignments/assignment-form";
import { AssignmentDetailModal } from "@/components/assignments/assignment-detail-modal";
import { StatusBadge } from "@/components/assignments/status-badge";
import { DataTable } from "@/components/forms/data-table";
import { EmptyState } from "@/components/forms/empty-state";
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
import {
  getAssignments,
  getWeeklySchedule
} from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";

type AssignmentRow = Awaited<ReturnType<typeof getAssignments>>[number];

function getAssignmentDayKey(assignment: AssignmentRow) {
  return formatDisplayDate(assignment.date, "yyyy-MM-dd");
}

function groupAssignmentsByDay(assignments: AssignmentRow[]) {
  const groups = new Map<
    string,
    {
      date: Date;
      assignments: AssignmentRow[];
    }
  >();

  for (const assignment of assignments) {
    const key = getAssignmentDayKey(assignment);
    const group = groups.get(key);

    if (group) {
      group.assignments.push(assignment);
      continue;
    }

    groups.set(key, {
      date: assignment.date,
      assignments: [assignment]
    });
  }

  return Array.from(groups.values());
}

function getVolunteerNames(assignment: AssignmentRow) {
  return (
    assignment.volunteers.map((item) => item.volunteer.name).join(" y ") ||
    "Sin voluntarios asignados"
  );
}

export default async function AdminAssignmentsPage() {
  const schedule = await getWeeklySchedule();

  const [assignments, preachingPoints, volunteers, currentWeek] =
    await Promise.all([
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
  const assignmentGroups = groupAssignmentsByDay(assignments);

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
      {assignmentGroups.length ? (
        <div className="space-y-5">
          {assignmentGroups.map((group) => {
            const confirmedCount = group.assignments.filter((assignment) =>
              ["CONFIRMED", "COMPLETED"].includes(assignment.status)
            ).length;
            const attentionCount = group.assignments.filter((assignment) =>
              [
                "PENDING_CONFIRMATION",
                "NEEDS_REPLACEMENT",
                "DECLINED"
              ].includes(assignment.status)
            ).length;

            return (
              <section
                key={formatDisplayDate(group.date, "yyyy-MM-dd")}
                className="border-white/6 overflow-hidden rounded-[24px] border bg-white/[0.025]"
              >
                <div className="border-white/6 flex flex-col gap-3 border-b bg-white/[0.025] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-semibold capitalize text-foreground">
                      {formatDisplayDate(group.date, "EEEE d 'de' MMMM")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {group.assignments.length} pareja
                      {group.assignments.length === 1 ? "" : "s"} programada
                      {group.assignments.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                      {confirmedCount} confirmada
                      {confirmedCount === 1 ? "" : "s"}
                    </span>
                    {attentionCount ? (
                      <span className="rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
                        {attentionCount} por revisar
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Horario</TableHead>
                        <TableHead>Punto</TableHead>
                        <TableHead>Pareja</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.assignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="whitespace-nowrap">
                            {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
                          </TableCell>
                          <TableCell>
                            {assignment.preachingPoint.name}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Pareja {assignment.pairNumber}
                              </p>
                              <p>{getVolunteerNames(assignment)}</p>
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
                </div>

                <div className="grid gap-3 p-3 lg:hidden">
                  {group.assignments.map((assignment) => (
                    <article
                      key={assignment.id}
                      className="border-white/6 rounded-[20px] border bg-background/25 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
                            </p>
                            <StatusBadge status={assignment.status} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {assignment.preachingPoint.name}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Pareja {assignment.pairNumber}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {getVolunteerNames(assignment)}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <AssignmentDetailModal
                            assignment={assignment}
                            preachingPoints={mappedPreachingPoints}
                            volunteers={volunteers}
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Sin asignaciones"
          description="Crea una pareja desde el horario semanal para empezar a organizar esta lista por día."
        />
      )}
    </DataTable>
  );
}
