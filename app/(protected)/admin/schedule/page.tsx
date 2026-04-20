import { EmptyState } from "@/components/forms/empty-state";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { WeeklyScheduleGrid } from "@/components/schedule/weekly-schedule-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWeeklySchedule } from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";
import { db } from "@/lib/db/prisma";

export default async function AdminSchedulePage() {
  const [schedule, preachingPoints, volunteers, currentWeek] = await Promise.all([
    getWeeklySchedule(),
    getPreachingPoints(),
    getVolunteers(),
    db.scheduleWeek.findFirst({
      orderBy: { startDate: "desc" }
    })
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-heading text-4xl font-semibold">Weekly Schedule</h1>
          <p className="text-sm text-muted-foreground">{schedule.weekLabel}</p>
        </div>
        {currentWeek ? (
          <AssignmentForm
            scheduleWeekId={currentWeek.id}
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
        ) : null}
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Planner</CardTitle>
        </CardHeader>
        <CardContent>
          {schedule.days.some((day) =>
            Object.values(day.items).some((items) => items.length > 0)
          ) ? (
            <WeeklyScheduleGrid schedule={schedule} />
          ) : (
            <EmptyState
              title="No assignments yet"
              description="Create the first assignment for this week to populate the planner."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
