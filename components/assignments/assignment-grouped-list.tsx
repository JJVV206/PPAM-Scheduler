"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
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
import {
  cn,
  formatCount,
  formatDateRange,
  formatDisplayDate
} from "@/lib/utils";
import type {
  AssignmentDetailDto,
  PreachingPointSummary
} from "@/types/domain";

const COLLAPSED_MONTHS_STORAGE_KEY = "ppam-assignments-collapsed-months";
const COLLAPSED_WEEKS_STORAGE_KEY = "ppam-assignments-collapsed-weeks";
const COLLAPSED_DAYS_STORAGE_KEY = "ppam-assignments-collapsed-days";

type AssignmentGroupedListProps = {
  assignments: AssignmentDetailDto[];
  preachingPoints: PreachingPointSummary[];
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

type AssignmentMonthGroup = {
  key: string;
  monthStart: Date;
  weeks: AssignmentWeekGroup[];
};

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getUtcDateParts(value: Date | string) {
  const date = new Date(value);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate()
  };
}

function getDisplayDate(value: Date | string) {
  const { year, month, day } = getUtcDateParts(value);

  return new Date(Date.UTC(year, month, day, 12));
}

function getDateKey(value: Date | string) {
  const { year, month, day } = getUtcDateParts(value);

  return `${year}-${padDatePart(month + 1)}-${padDatePart(day)}`;
}

function getMonthKey(value: Date | string) {
  const { year, month } = getUtcDateParts(value);

  return `${year}-${padDatePart(month + 1)}`;
}

function getMonthStart(value: Date | string) {
  const { year, month } = getUtcDateParts(value);

  return new Date(Date.UTC(year, month, 1, 12));
}

function getWeekStart(value: Date | string) {
  const { year, month, day } = getUtcDateParts(value);
  const date = new Date(Date.UTC(year, month, day, 12));
  const dayOffset = (date.getUTCDay() + 6) % 7;

  date.setUTCDate(date.getUTCDate() - dayOffset);

  return date;
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
        date: getDisplayDate(assignment.date),
        assignments: []
      };
      weekGroup.days.push(dayGroup);
    }

    dayGroup.assignments.push(assignment);
  }

  return Array.from(weekGroups.values());
}

function groupWeeksByMonth(weekGroups: AssignmentWeekGroup[]) {
  const monthGroups = new Map<string, AssignmentMonthGroup>();

  for (const weekGroup of weekGroups) {
    const monthStart = getMonthStart(weekGroup.startDate);
    const monthKey = getMonthKey(monthStart);
    let monthGroup = monthGroups.get(monthKey);

    if (!monthGroup) {
      monthGroup = {
        key: monthKey,
        monthStart,
        weeks: []
      };
      monthGroups.set(monthKey, monthGroup);
    }

    monthGroup.weeks.push(weekGroup);
  }

  return Array.from(monthGroups.values());
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
  preachingPoints
}: AssignmentGroupedListProps) {
  const weekGroups = useMemo(
    () => groupAssignmentsByWeek(assignments),
    [assignments]
  );
  const monthGroups = useMemo(
    () => groupWeeksByMonth(weekGroups),
    [weekGroups]
  );
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    setCollapsedMonths(readStoredSet(COLLAPSED_MONTHS_STORAGE_KEY));
    setCollapsedWeeks(readStoredSet(COLLAPSED_WEEKS_STORAGE_KEY));
    setCollapsedDays(readStoredSet(COLLAPSED_DAYS_STORAGE_KEY));
  }, []);

  function toggleCollapsedMonth(monthKey: string) {
    setCollapsedMonths((currentValue) => {
      const nextValue = new Set(currentValue);

      if (nextValue.has(monthKey)) {
        nextValue.delete(monthKey);
      } else {
        nextValue.add(monthKey);
      }

      writeStoredSet(COLLAPSED_MONTHS_STORAGE_KEY, nextValue);
      return nextValue;
    });
  }

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
    <div className="space-y-6">
      {monthGroups.map((monthGroup) => {
        const monthAssignments = monthGroup.weeks.flatMap((weekGroup) =>
          weekGroup.days.flatMap((dayGroup) => dayGroup.assignments)
        );
        const monthDayCount = monthGroup.weeks.reduce(
          (total, weekGroup) => total + weekGroup.days.length,
          0
        );
        const monthCounts = getAssignmentCounts(monthAssignments);
        const isMonthCollapsed = collapsedMonths.has(monthGroup.key);

        return (
          <section
            key={monthGroup.key}
            className="overflow-hidden rounded-xl border border-primary/25 bg-primary/[0.035]"
          >
            <div className="flex flex-col gap-3 border-b border-primary/20 bg-primary/[0.06] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Mes
                </p>
                <h2 className="mt-1 font-heading text-xl font-semibold capitalize text-foreground">
                  {formatDisplayDate(monthGroup.monthStart, "MMMM yyyy")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCount(monthAssignments.length, "pareja")} en{" "}
                  {formatCount(monthGroup.weeks.length, "semana")} y{" "}
                  {formatCount(monthDayCount, "día", "días")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-success/20 bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                  {formatCount(monthCounts.confirmedCount, "confirmada")}
                </span>
                {monthCounts.attentionCount ? (
                  <span className="rounded-md border border-warning/20 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                    {monthCounts.attentionCount} por revisar
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCollapsedMonth(monthGroup.key)}
                  aria-expanded={!isMonthCollapsed}
                  aria-controls={`assignment-month-${monthGroup.key}`}
                >
                  {isMonthCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {isMonthCollapsed ? "Mostrar mes" : "Minimizar mes"}
                </Button>
              </div>
            </div>

            <div
              id={`assignment-month-${monthGroup.key}`}
              className={cn(
                "space-y-3 border-l border-primary/25 px-3 pb-4 pl-4 pt-3 sm:ml-4 sm:pl-5",
                isMonthCollapsed && "hidden"
              )}
            >
              {monthGroup.weeks.map((weekGroup) => {
                const weekAssignments = weekGroup.days.flatMap(
                  (dayGroup) => dayGroup.assignments
                );
                const weekCounts = getAssignmentCounts(weekAssignments);
                const isWeekCollapsed = collapsedWeeks.has(weekGroup.key);

                return (
                  <section
                    key={weekGroup.key}
                    className="overflow-hidden rounded-lg border border-l-4 border-border/70 border-l-primary/45 bg-background/45"
                  >
                    <div className="flex flex-col gap-3 border-b border-border/65 bg-surface-elevated/45 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Semana
                        </p>
                        <h3 className="mt-1 font-heading text-lg font-semibold text-foreground">
                          {formatDateRange(
                            weekGroup.startDate,
                            weekGroup.endDate
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatCount(weekAssignments.length, "pareja")} en{" "}
                          {formatCount(weekGroup.days.length, "día", "días")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-success/20 bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                          {formatCount(weekCounts.confirmedCount, "confirmada")}
                        </span>
                        {weekCounts.attentionCount ? (
                          <span className="rounded-md border border-warning/20 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                            {weekCounts.attentionCount} por revisar
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
                          {isWeekCollapsed
                            ? "Mostrar semana"
                            : "Minimizar semana"}
                        </Button>
                      </div>
                    </div>

                    <div
                      id={`assignment-week-${weekGroup.key}`}
                      className={cn(
                        "space-y-3 border-l border-border/70 p-3 pl-4 sm:ml-4 sm:p-4 sm:pl-5",
                        isWeekCollapsed && "hidden"
                      )}
                    >
                      {weekGroup.days.map((dayGroup) => {
                        const dayCounts = getAssignmentCounts(
                          dayGroup.assignments
                        );
                        const isDayCollapsed = collapsedDays.has(dayGroup.key);

                        return (
                          <section
                            key={dayGroup.key}
                            className="overflow-hidden rounded-lg border border-l-4 border-border/60 border-l-muted-foreground/25 bg-surface-elevated/20"
                          >
                            <div className="flex flex-col gap-3 border-b border-border/60 bg-background/35 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <h4 className="font-heading text-base font-semibold capitalize text-foreground">
                                  {formatDisplayDate(
                                    dayGroup.date,
                                    "EEEE d 'de' MMMM"
                                  )}
                                </h4>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {formatCount(
                                    dayGroup.assignments.length,
                                    "pareja programada",
                                    "parejas programadas"
                                  )}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md border border-success/20 bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                                  {formatCount(
                                    dayCounts.confirmedCount,
                                    "confirmada"
                                  )}
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
                                  onClick={() =>
                                    toggleCollapsedDay(dayGroup.key)
                                  }
                                  aria-expanded={!isDayCollapsed}
                                  aria-controls={`assignment-day-${dayGroup.key}`}
                                >
                                  {isDayCollapsed ? (
                                    <ChevronRight className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                  {isDayCollapsed
                                    ? "Mostrar día"
                                    : "Minimizar día"}
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
                                            TIME_SLOT_DEFINITIONS[
                                              assignment.timeSlot
                                            ].label
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
                                            <p>
                                              {getVolunteerNames(assignment)}
                                            </p>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <StatusBadge
                                            status={assignment.status}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <AutomationStateBadge
                                            state={assignment.automationState}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex justify-end gap-2">
                                            <Button
                                              asChild
                                              variant="secondary"
                                              size="sm"
                                            >
                                              <Link
                                                href={`/admin/assignments/${assignment.id}`}
                                              >
                                                Ver detalles
                                              </Link>
                                            </Button>
                                            <AssignmentDetailModal
                                              assignment={assignment}
                                              triggerLabel="Vista rápida"
                                              preachingPoints={preachingPoints}
                                            />
                                          </div>
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
                                              TIME_SLOT_DEFINITIONS[
                                                assignment.timeSlot
                                              ].label
                                            }
                                          </p>
                                          <StatusBadge
                                            status={assignment.status}
                                          />
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
                                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                                        <Button
                                          asChild
                                          variant="secondary"
                                          size="sm"
                                        >
                                          <Link
                                            href={`/admin/assignments/${assignment.id}`}
                                          >
                                            Ver detalles
                                          </Link>
                                        </Button>
                                        <AssignmentDetailModal
                                          assignment={assignment}
                                          triggerLabel="Vista rápida"
                                          preachingPoints={preachingPoints}
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
          </section>
        );
      })}
    </div>
  );
}
