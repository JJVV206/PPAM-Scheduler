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
          aria-label="Horario semanal de lunes a domingo"
          className="grid h-full min-h-[640px] w-full grid-cols-[84px_repeat(7,minmax(0,1fr))] grid-rows-[58px_repeat(5,minmax(96px,1fr))] gap-px overflow-clip rounded-lg border border-border/70 bg-border/70"
          role="grid"
        >
          <div
            aria-hidden="true"
            className="sticky top-0 z-30 bg-surface-elevated p-2 shadow-[0_1px_0_hsl(var(--border))]"
          />
          {schedule.days.map((day) => (
            <div
              key={day.dayOfWeek}
              className="sticky top-0 z-30 min-w-0 bg-surface-elevated px-2 py-2 text-center shadow-[0_1px_0_hsl(var(--border))]"
              role="columnheader"
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
              <div
                aria-label={TIME_SLOT_DEFINITIONS[timeSlot].label}
                className="min-w-0 bg-surface-elevated px-2 py-2"
                role="rowheader"
              >
                <p className="text-sm font-semibold leading-tight text-foreground">
                  {TIME_SLOT_DEFINITIONS[timeSlot].shortLabel}
                </p>
              </div>
              {schedule.days.map((day) => {
                const groups = day.items[timeSlot];

                return (
                  <div
                    key={`${day.dayOfWeek}-${timeSlot}`}
                    className="h-full min-w-0 bg-surface p-1"
                    role="gridcell"
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
