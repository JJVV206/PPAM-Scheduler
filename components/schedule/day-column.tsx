import { format } from "date-fns";
import { es } from "date-fns/locale";

import { TimeSlotBlock } from "@/components/schedule/time-slot-block";
import { TIME_SLOTS } from "@/lib/constants/domain";
import type { WeeklyScheduleMatrix } from "@/types/domain";

type DayColumnProps = {
  day: WeeklyScheduleMatrix["days"][number];
};

export function DayColumn({ day }: DayColumnProps) {
  const occupiedSlotCount = TIME_SLOTS.filter(
    (timeSlot) => day.items[timeSlot].length > 0
  ).length;

  return (
    <section className="surface-panel space-y-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-xl font-semibold capitalize">
            {format(day.date, "EEEE", { locale: es })}
          </p>
          <p className="text-sm text-muted-foreground">
            {format(day.date, "d 'de' MMM", { locale: es })}
          </p>
        </div>
        <span className="rounded-md border border-border/70 bg-background/35 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {occupiedSlotCount
            ? `${occupiedSlotCount} horario${occupiedSlotCount > 1 ? "s" : ""}`
            : "Libre"}
        </span>
      </div>
      <div className="space-y-2.5">
        {TIME_SLOTS.map((timeSlot) => (
          <TimeSlotBlock
            key={timeSlot}
            date={day.date}
            timeSlot={timeSlot}
            assignments={day.items[timeSlot]}
          />
        ))}
      </div>
    </section>
  );
}
