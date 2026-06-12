import { Fragment } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { DayColumn } from "@/components/schedule/day-column";
import { ScheduleSlotPreview } from "@/components/schedule/schedule-slot-preview";
import type { WeeklyScheduleMatrix } from "@/types/domain";
import { TIME_SLOTS, TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";

type WeeklyScheduleGridProps = {
  schedule: WeeklyScheduleMatrix;
};

export function WeeklyScheduleGrid({ schedule }: WeeklyScheduleGridProps) {
  return (
    <div className="h-full min-w-0 overflow-x-auto overflow-y-auto">
      <div className="space-y-3 xl:hidden">
        {schedule.days.map((day) => (
          <DayColumn key={day.dayOfWeek} day={day} />
        ))}
      </div>

      <div className="hidden h-full min-w-[980px] xl:block">
        <div
          aria-hidden="true"
          className="pointer-events-none sticky top-0 z-40 h-0"
        >
          <div className="absolute left-0 top-0 h-6 w-6 bg-[radial-gradient(circle_at_bottom_right,transparent_23px,hsl(var(--surface))_24px)]" />
          <div className="absolute right-0 top-0 h-6 w-6 bg-[radial-gradient(circle_at_bottom_left,transparent_23px,hsl(var(--surface))_24px)]" />
        </div>
        <div className="grid h-full min-h-[720px] w-full grid-cols-[92px_repeat(7,minmax(0,1fr))] grid-rows-[68px_repeat(5,minmax(112px,1fr))] gap-px overflow-clip rounded-[24px] border border-border/70 bg-border/70">
          <div className="sticky top-0 z-30 bg-surface-elevated p-2 shadow-[0_1px_0_rgba(49,64,94,0.7)]" />
          {schedule.days.map((day) => (
            <div
              key={day.dayOfWeek}
              className="sticky top-0 z-30 min-w-0 bg-surface-elevated px-2 py-2 text-center shadow-[0_1px_0_rgba(49,64,94,0.7)] xl:px-3"
            >
              <p className="font-heading text-sm font-semibold text-foreground lg:text-base">
                {format(day.date, "EEE", { locale: es })}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(day.date, "d 'de' MMM", { locale: es })}
              </p>
            </div>
          ))}

          {TIME_SLOTS.map((timeSlot) => (
            <Fragment key={timeSlot}>
              <div className="min-w-0 bg-surface-elevated px-2 py-2.5 xl:px-3">
                <p className="text-sm font-semibold leading-tight text-foreground xl:text-[15px]">
                  {TIME_SLOT_DEFINITIONS[timeSlot].shortLabel}
                </p>
              </div>
              {schedule.days.map((day) => {
                const groups = day.items[timeSlot];

                return (
                  <div
                    key={`${day.dayOfWeek}-${timeSlot}`}
                    className="h-full min-w-0 bg-surface p-1.5"
                  >
                    <ScheduleSlotPreview
                      assignments={groups}
                      compact
                      date={day.date}
                      timeSlot={timeSlot}
                    />
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
