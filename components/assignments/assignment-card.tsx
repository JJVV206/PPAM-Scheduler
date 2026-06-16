import { Clock3, MapPin, Users2 } from "lucide-react";

import { AutomationStateBadge } from "@/components/assignments/automation-state-badge";
import { StatusBadge } from "@/components/assignments/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { cn } from "@/lib/utils";
import type { AssignmentDetailDto } from "@/types/domain";

type AssignmentCardProps = {
  assignment: AssignmentDetailDto;
  action?: React.ReactNode;
  className?: string;
};

export function AssignmentCard({
  assignment,
  action,
  className
}: AssignmentCardProps) {
  const volunteerNames = assignment.volunteers.map(
    (item) => item.volunteer.name
  );
  const point = assignment.preachingPoint;

  return (
    <Card
      className={cn("h-full border border-white/5 bg-white/[0.03]", className)}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-semibold">{point.name}</p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {point.area}
            </p>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Pareja {assignment.pairNumber}
            </p>
          </div>
          <div className="flex max-w-[11rem] flex-col items-end gap-2">
            <StatusBadge status={assignment.status} />
            <AutomationStateBadge state={assignment.automationState} />
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
          </div>
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            {volunteerNames.length
              ? volunteerNames.join(" y ")
              : "Esperando pareja"}
          </div>
        </div>

        {"warnings" in assignment && assignment.warnings.length ? (
          <div className="rounded-2xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
            {assignment.warnings.join(" • ")}
          </div>
        ) : null}

        {action}
      </CardContent>
    </Card>
  );
}
