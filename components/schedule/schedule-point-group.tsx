import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AssignmentStatus, WeeklySchedulePointCell } from "@/types/domain";

type SchedulePointGroupProps = {
  group: WeeklySchedulePointCell;
};

const compactStatusMap: Record<
  AssignmentStatus,
  { label: string; className: string }
> = {
  SCHEDULED: {
    label: "Programada",
    className: "border-border/70 bg-secondary text-secondary-foreground"
  },
  PENDING_CONFIRMATION: {
    label: "Pendiente",
    className: "border-warning/25 bg-warning/15 text-warning"
  },
  CONFIRMED: {
    label: "Confirmada",
    className: "border-success/25 bg-success/15 text-success"
  },
  DECLINED: {
    label: "Rechazada",
    className: "border-danger/25 bg-danger/15 text-danger"
  },
  NEEDS_REPLACEMENT: {
    label: "Reemplazo",
    className: "border-danger/25 bg-danger/15 text-danger"
  },
  REASSIGNED: {
    label: "Reasignada",
    className: "border-primary/40 bg-primary/15 text-primary"
  },
  COMPLETED: {
    label: "Completada",
    className: "border-success/25 bg-success/15 text-success"
  },
  CANCELLED: {
    label: "Cancelada",
    className: "border-border bg-transparent text-foreground"
  }
};

export function SchedulePointGroup({ group }: SchedulePointGroupProps) {
  return (
    <div className="space-y-1.5">
      {group.pairs.map((pair) => (
        <Link
          key={pair.id}
          href={`/admin/assignments/${pair.id}`}
          className="group flex min-h-14 items-center justify-between gap-2 rounded-lg border border-border/65 bg-background/35 px-2.5 py-2 transition hover:border-primary/30 hover:bg-background/50"
        >
          <div className="min-w-0 flex-1">
            <p className="overflow-hidden text-[12px] font-semibold leading-tight text-foreground">
              {group.preachingPointName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pareja {pair.pairNumber}
              </span>
              <span
                className={cn(
                  "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-none",
                  compactStatusMap[pair.status].className
                )}
              >
                {compactStatusMap[pair.status].label}
              </span>
            </div>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
        </Link>
      ))}
    </div>
  );
}
