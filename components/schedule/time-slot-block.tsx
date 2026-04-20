import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import type { TimeSlot, WeeklyScheduleCell } from "@/types/domain";

import { AssignmentCard } from "@/components/assignments/assignment-card";

type TimeSlotBlockProps = {
  timeSlot: TimeSlot;
  assignments: WeeklyScheduleCell[];
  emptyState?: React.ReactNode;
};

export function TimeSlotBlock({
  timeSlot,
  assignments,
  emptyState
}: TimeSlotBlockProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <div className="h-2 w-2 rounded-full bg-primary" />
        {TIME_SLOT_DEFINITIONS[timeSlot].label}
      </div>
      <div className="space-y-3">
        {assignments.length ? (
          assignments.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))
        ) : (
          emptyState ?? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-white/[0.02] p-4 text-sm text-muted-foreground">
              No assignments
            </div>
          )
        )}
      </div>
    </div>
  );
}
