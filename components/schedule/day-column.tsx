import { format } from "date-fns";
import { es } from "date-fns/locale";

import { TimeSlotBlock } from "@/components/schedule/time-slot-block";
import { TIME_SLOTS } from "@/lib/constants/domain";
import type { WeeklyScheduleMatrix } from "@/types/domain";

type DayColumnProps = {
  day: WeeklyScheduleMatrix["days"][number];
};

export function DayColumn({ day }: DayColumnProps) {
  return (
    <div className="surface-panel min-w-[280px] space-y-5 p-5">
      <div>
        <p className="font-heading text-xl font-semibold">
          {format(day.date, "EEEE", { locale: es })}
        </p>
        <p className="text-sm text-muted-foreground">
          {format(day.date, "d 'de' MMM", { locale: es })}
        </p>
      </div>
      {TIME_SLOTS.map((timeSlot) => (
        <TimeSlotBlock
          key={timeSlot}
          timeSlot={timeSlot}
          assignments={day.items[timeSlot]}
        />
      ))}
    </div>
  );
}
