import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { ScheduleSlotPreview } from "@/components/schedule/schedule-slot-preview";
import type { TimeSlot, WeeklySchedulePointCell } from "@/types/domain";

type TimeSlotBlockProps = {
  compactPreview?: boolean;
  date: Date;
  timeSlot: TimeSlot;
  assignments: WeeklySchedulePointCell[];
};

export function TimeSlotBlock({
  compactPreview = false,
  date,
  timeSlot,
  assignments
}: TimeSlotBlockProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span>{TIME_SLOT_DEFINITIONS[timeSlot].label}</span>
      </div>
      <ScheduleSlotPreview
        assignments={assignments}
        compact={compactPreview}
        date={date}
        timeSlot={timeSlot}
      />
    </div>
  );
}
