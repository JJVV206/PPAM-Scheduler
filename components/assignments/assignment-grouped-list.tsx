"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, startOfWeek } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";

import { AutomationStateBadge } from "@/components/assignments/automation-state-badge";
import { AssignmentDetailModal } from "@/components/assignments/assignment-detail-modal";
import { StatusBadge } from "@/components/assignments/status-badge";
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
import { cn, formatDisplayDate } from "@/lib/utils";
import type {
  AssignmentDetailDto,
  PreachingPointSummary,
  VolunteerSummary
} from "@/types/domain";

const COLLAPSED_WEEKS_STORAGE_KEY = "ppam-assignments-collapsed-weeks";
const COLLAPSED_DAYS_STORAGE_KEY = "ppam-assignments-collapsed-days";

type AssignmentGroupedListProps = {
  assignments: AssignmentDetailDto[];
  preachingPoints: PreachingPointSummary[];
  volunteers: VolunteerSummary[];
};

type AssignmentDayGroup = {
  key: string;
  date: Date;
  assignments: AssignmentDetailDto[];
};

type AssignmentWeekGroup = {
  key: string;
  startDate: Date;
  endDate: Date;
  days: AssignmentDayGroup[];
};

function getDateKey(value: Date | string) {
  return formatDisplayDate(value, "yyyy-MM-dd");
}

function getWeekStart(value: Date | string) {
  return startOfWeek(new Date(value), { weekStartsOn: 1 });
}

function groupAssignmentsByWeek(assignments: AssignmentDetailDto[]) {
  const weekGroups = new Map<string, AssignmentWeekGroup>();

  for (const assignment of assignments) {
    const weekStart = getWeekStart(assignment.date);
    const weekKey = getDateKey(weekStart);
    const dayKey = getDateKey(assignment.date);
    let weekGroup = weekGroups.get(weekKey);

    if (!weekGroup) {
      weekGroup = {
        key: weekKey,
        startDate: weekStart,
        endDate: addDays(weekStart, 6),
        days: []
      };
      weekGroups.set(weekKey, weekGroup);
    }

    let dayGroup = weekGroup.days.find((group) => group.key === dayKey);

    if (!dayGroup) {
      dayGroup = {
        key: dayKey,
        date: new Date(assignment.date),
        assignments: []
      };
      weekGroup.days.push(dayGroup);
    }

    dayGroup.assignments.push(assignment);
  }

  return Array.from(weekGroups.values());
}

function getVolunteerNames(assignment: AssignmentDetailDto) {
  return (
    assignment.volunteers.map((item) => item.volunteer.name).join(" y ") ||
    "Sin voluntarios asignados"
  );
}

function getAssignmentCounts(assignments: AssignmentDetailDto[]) {
  const confirmedCount = assignments.filter((assignment) =>
    ["CONFIRMED", "COMPLETED"].includes(assignment.status)
  ).length;
  const attentionCount = assignments.filter(
    (assignment) =>
      assignment.requiresAttention ||
      ["PENDING_CONFIRMATION", "NEEDS_REPLACEMENT", "DECLINED"].includes(
        assignment.status
      )
  ).length;

  return {
    confirmedCount,
    attentionCount
  };
}

function readStoredSet(key: string) {
  try {
    const rawValue = window.localStorage.getItem(key);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    return new Set(
      Array.isArray(parsedValue)
        ? parsedValue.filter((item): item is string => typeof item === "string")
        : []
    );
  } catch {
    return new Set<string>();
  }
}

function writeStoredSet(key: string, value: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify([...value]));
}

export function AssignmentGroupedList({
  assignments,
  preachingPoints,
  volunteers
}: AssignmentGroupedListProps) {
  const weekGroups = useMemo(
    () => groupAssignmentsByWeek(assignments),
    [assignments]
  );
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    setCollapsedWeeks(readStoredSet(COLLAPSED_WEEKS_STORAGE_KEY));
    setCollapsedDays(readStoredSet(COLLAPSED_DAYS_STORAGE_KEY));
  }, []);

  function toggleCollapsedWeek(weekKey: string) {
    setCollapsedWeeks((currentValue) => {
      const nextValue = new Set(currentValue);

      if (nextValue.has(weekKey)) {
        nextValue.delete(weekKey);
      } else {
        nextValue.add(weekKey);
      }

      writeStoredSet(COLLAPSED_WEEKS_STORAGE_KEY, nextValue);
      return nextValue;
    });
  }

  function toggleCollapsedDay(dayKey: string) {
    setCollapsedDays((currentValue) => {
      const nextValue = new Set(currentValue);

      if (nextValue.has(dayKey)) {
        nextValue.delete(dayKey);
      } else {
        nextValue.add(dayKey);
      }

      writeStoredSet(COLLAPSED_DAYS_STORAGE_KEY, nextValue);
      return nextValue;
    });
  }

  return (
    <div className="space-y-4">
      {weekGroups.map((weekGroup) => {
        const weekAssignments = weekGroup.days.flatMap(
          (dayGroup) => dayGroup.assignments
        );
        const { confirmedCount, attentionCount } =
          getAssignmentCounts(weekAssignments);
        const isWeekCollapsed = collapsedWeeks.has(weekGroup.key);

        return (
          <section
            key={weekGroup.key}
            className="overflow-hidden rounded-lg border border-border/70 bg-background/20"
          >
            <div className="flex flex-col gap-3 border-b border-border/65 bg-surface-elevated/40 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Semana
                </p>
                <h2 className="mt-1 font-heading text-lg font-semibold text-foreground">
                  Del {formatDisplayDate(weekGroup.startDate, "d")} al{" "}
                  {formatDisplayDate(weekGroup.endDate, "d 'de' MMMM yyyy")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {weekAssignments.length} pareja
                  {weekAssignments.length === 1 ? "" : "s"} en{" "}
                  {weekGroup.days.length} día
                  {weekGroup.days.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-success/20 bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                  {confirmedCount} confirmada
                  {confirmedCount === 1 ? "" : "s"}
                </span>
                {attentionCount ? (
                  <span className="rounded-md border border-warning/20 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                    {attentionCount} por revisar
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCollapsedWeek(weekGroup.key)}
                  aria-expanded={!isWeekCollapsed}
                  aria-controls={`assignment-week-${weekGroup.key}`}
                >
                  {isWeekCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {isWeekCollapsed ? "Mostrar semana" : "Minimizar semana"}
                </Button>
              </div>
            </div>

            <div
              id={`assignment-week-${weekGroup.key}`}
              className={cn(
                "space-y-4 p-3 sm:p-4",
                isWeekCollapsed && "hidden"
              )}
            >
              {weekGroup.days.map((dayGroup) => {
                const dayCounts = getAssignmentCounts(dayGroup.assignments);
                const isDayCollapsed = collapsedDays.has(dayGroup.key);

                return (
                  <section
                    key={dayGroup.key}
                    className="overflow-hidden rounded-lg border border-border/60 bg-background/25"
                  >
                    <div className="flex flex-col gap-3 border-b border-border/60 bg-surface-elevated/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-heading text-base font-semibold capitalize text-foreground">
                          {formatDisplayDate(dayGroup.date, "EEEE d 'de' MMMM")}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {dayGroup.assignments.length} pareja
                          {dayGroup.assignments.length === 1 ? "" : "s"}{" "}
                          programada
                          {dayGroup.assignments.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-success/20 bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                          {dayCounts.confirmedCount} confirmada
                          {dayCounts.confirmedCount === 1 ? "" : "s"}
                        </span>
                        {dayCounts.attentionCount ? (
                          <span className="rounded-md border border-warning/20 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                            {dayCounts.attentionCount} por revisar
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCollapsedDay(dayGroup.key)}
                          aria-expanded={!isDayCollapsed}
                          aria-controls={`assignment-day-${dayGroup.key}`}
                        >
                          {isDayCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          {isDayCollapsed ? "Mostrar día" : "Minimizar día"}
                        </Button>
                      </div>
                    </div>

                    <div
                      id={`assignment-day-${dayGroup.key}`}
                      className={cn(isDayCollapsed && "hidden")}
                    >
                      <div className="hidden lg:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Horario</TableHead>
                              <TableHead>Punto</TableHead>
                              <TableHead>Pareja</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Proceso</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dayGroup.assignments.map((assignment) => (
                              <TableRow key={assignment.id}>
                                <TableCell className="whitespace-nowrap">
                                  {
                                    TIME_SLOT_DEFINITIONS[assignment.timeSlot]
                                      .label
                                  }
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
                                <TableCell>
                                  <AutomationStateBadge
                                    state={assignment.automationState}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <AssignmentDetailModal
                                    assignment={assignment}
                                    preachingPoints={preachingPoints}
                                    volunteers={volunteers}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="grid gap-2.5 p-3 lg:hidden">
                        {dayGroup.assignments.map((assignment) => (
                          <article
                            key={assignment.id}
                            className="rounded-lg border border-border/60 bg-background/35 p-3"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {
                                      TIME_SLOT_DEFINITIONS[assignment.timeSlot]
                                        .label
                                    }
                                  </p>
                                  <StatusBadge status={assignment.status} />
                                  <AutomationStateBadge
                                    state={assignment.automationState}
                                  />
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
                                  preachingPoints={preachingPoints}
                                  volunteers={volunteers}
                                />
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
