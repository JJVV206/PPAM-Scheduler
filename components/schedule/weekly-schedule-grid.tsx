import { Fragment } from "react";
import { format } from "date-fns";

import { SchedulePointGroup } from "@/components/schedule/schedule-point-group";
import type { WeeklyScheduleMatrix } from "@/types/domain";
import { TIME_SLOTS, TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";

type WeeklyScheduleGridProps = {
  schedule: WeeklyScheduleMatrix;
};

export function WeeklyScheduleGrid({ schedule }: WeeklyScheduleGridProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1180px] grid-cols-[92px_repeat(7,minmax(148px,1fr))] gap-px overflow-hidden rounded-[28px] border border-border/70 bg-border/70">
        <div className="bg-surface-elevated p-4" />
        {schedule.days.map((day) => (
          <div
            key={day.dayOfWeek}
            className="bg-surface-elevated px-3 py-4 text-center"
          >
            <p className="font-heading text-base font-semibold text-foreground xl:text-lg">
              {format(day.date, "EEE")}
            </p>
            <p className="text-sm text-muted-foreground">{format(day.date, "MMM d")}</p>
          </div>
        ))}

        {TIME_SLOTS.map((timeSlot) => (
          <Fragment key={timeSlot}>
            <div
              className="bg-surface-elevated px-3 py-3.5"
            >
              <p className="font-semibold text-foreground xl:text-[15px]">
                {TIME_SLOT_DEFINITIONS[timeSlot].shortLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {TIME_SLOT_DEFINITIONS[timeSlot].label}
              </p>
            </div>
            {schedule.days.map((day) => {
              const groups = day.items[timeSlot];

              return (
                <div
                  key={`${day.dayOfWeek}-${timeSlot}`}
                  className="min-h-[188px] bg-surface p-2.5 xl:p-3"
                >
                  <div className="space-y-2.5">
                    {groups.length ? (
                      groups.map((group) => (
                        <SchedulePointGroup
                          key={`${group.preachingPointId}-${group.timeSlot}`}
                          group={group}
                        />
                      ))
                    ) : (
                      <div className="flex min-h-20 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/30 px-3 py-4 text-center text-sm text-muted-foreground">
                        No couples assigned
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
