import { MapPin, Users2 } from "lucide-react";

import { StatusBadge } from "@/components/assignments/status-badge";
import type { WeeklySchedulePointCell } from "@/types/domain";

type SchedulePointGroupProps = {
  group: WeeklySchedulePointCell;
};

export function SchedulePointGroup({ group }: SchedulePointGroupProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-2.5 xl:p-3">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-tight text-foreground">
            {group.preachingPointName}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground xl:text-xs">
            <MapPin className="h-3.5 w-3.5" />
            {group.area}
          </p>
        </div>
        <div className="rounded-full bg-primary/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          {group.pairs.length} couple{group.pairs.length > 1 ? "s" : ""}
        </div>
      </div>

      <div className="space-y-2">
        {group.pairs.map((pair) => (
          <div
            key={pair.id}
            className="rounded-2xl border border-border/70 bg-background/40 p-2.5"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Couple {pair.pairNumber}
              </p>
              <StatusBadge status={pair.status} />
            </div>
            <p className="flex items-start gap-2 text-sm leading-snug text-foreground">
              <Users2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              {pair.volunteerNames.length ? pair.volunteerNames.join(" & ") : "Awaiting pair"}
            </p>
            {pair.warnings.length ? (
              <p className="mt-2 text-xs text-warning">
                {pair.warnings.join(" • ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
