import { ScrollArea } from "@/components/ui/scroll-area";
import type { WeeklyScheduleMatrix } from "@/types/domain";

import { DayColumn } from "@/components/schedule/day-column";

type WeeklyScheduleGridProps = {
  schedule: WeeklyScheduleMatrix;
};

export function WeeklyScheduleGrid({ schedule }: WeeklyScheduleGridProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex min-w-max gap-4 pb-4">
        {schedule.days.map((day) => (
          <DayColumn key={day.dayOfWeek} day={day} />
        ))}
      </div>
    </ScrollArea>
  );
}
