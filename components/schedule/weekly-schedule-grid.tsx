import { Fragment } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { SchedulePointGroup } from "@/components/schedule/schedule-point-group";
import type { WeeklyScheduleMatrix } from "@/types/domain";
import { TIME_SLOTS, TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";

type WeeklyScheduleGridProps = {
  schedule: WeeklyScheduleMatrix;
};

export function WeeklyScheduleGrid({ schedule }: WeeklyScheduleGridProps) {
  return (
    <div className="h-full overflow-x-hidden">
      <div className="grid h-full w-full grid-cols-[74px_repeat(7,minmax(0,1fr))] grid-rows-[72px_repeat(5,minmax(0,1fr))] gap-px overflow-hidden rounded-[24px] border border-border/70 bg-border/70 lg:grid-cols-[78px_repeat(7,minmax(0,1fr))] lg:grid-rows-[78px_repeat(5,minmax(0,1fr))] xl:grid-cols-[82px_repeat(7,minmax(0,1fr))] xl:grid-rows-[84px_repeat(5,minmax(0,1fr))]">
        <div className="bg-surface-elevated p-2.5 xl:p-3" />
        {schedule.days.map((day) => (
          <div
            key={day.dayOfWeek}
            className="min-w-0 bg-surface-elevated px-2 py-2 text-center xl:px-3 xl:py-3"
          >
            <p className="font-heading text-sm font-semibold text-foreground lg:text-base xl:text-lg">
              {format(day.date, "EEE", { locale: es })}
            </p>
            <p className="text-xs text-muted-foreground lg:text-sm">
              {format(day.date, "d 'de' MMM", { locale: es })}
            </p>
          </div>
        ))}

        {TIME_SLOTS.map((timeSlot) => (
          <Fragment key={timeSlot}>
            <div className="min-w-0 bg-surface-elevated px-2 py-2.5 xl:px-3 xl:py-3">
              <p className="text-sm font-semibold leading-tight text-foreground xl:text-[15px]">
                {TIME_SLOT_DEFINITIONS[timeSlot].shortLabel}
              </p>
            </div>
            {schedule.days.map((day) => {
              const groups = day.items[timeSlot];

              return (
                <div
                  key={`${day.dayOfWeek}-${timeSlot}`}
                  className="h-full min-w-0 bg-surface p-1.5 md:p-2"
                >
                  <div className="h-full space-y-1.5">
                    {groups.length ? (
                      groups.map((group) => (
                        <SchedulePointGroup
                          key={`${group.preachingPointId}-${group.timeSlot}`}
                          group={group}
                        />
                      ))
                    ) : (
                      <div className="flex h-full min-h-0 items-center justify-center rounded-[18px] border border-dashed border-border/70 bg-background/30 px-2 py-2 text-center text-xs text-muted-foreground md:text-sm">
                        Sin parejas asignadas
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
