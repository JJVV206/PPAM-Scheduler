import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import type { TimeSlot, WeeklySchedulePointCell } from "@/types/domain";
import { SchedulePointGroup } from "@/components/schedule/schedule-point-group";

type TimeSlotBlockProps = {
  timeSlot: TimeSlot;
  assignments: WeeklySchedulePointCell[];
  emptyState?: React.ReactNode;
};

export function TimeSlotBlock({
  timeSlot,
  assignments,
  emptyState
}: TimeSlotBlockProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span>{TIME_SLOT_DEFINITIONS[timeSlot].label}</span>
      </div>
      <div className="space-y-2.5">
        {assignments.length ? (
          assignments.map((assignment) => (
            <SchedulePointGroup
              key={`${assignment.preachingPointId}-${assignment.timeSlot}`}
              group={assignment}
            />
          ))
        ) : (
          emptyState ?? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-white/[0.02] px-3 py-2 text-sm text-muted-foreground">
              Sin asignaciones
            </div>
          )
        )}
      </div>
    </div>
  );
}
