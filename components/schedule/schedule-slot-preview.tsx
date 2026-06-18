import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, Layers3, MapPin, Users2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AssignmentStatus,
  TimeSlot,
  WeeklySchedulePointCell
} from "@/types/domain";

type ScheduleSlotPreviewProps = {
  assignments: WeeklySchedulePointCell[];
  compact?: boolean;
  date: Date;
  timeSlot: TimeSlot;
};

type PreviewPair = WeeklySchedulePointCell["pairs"][number] & {
  area: string;
  preachingPointName: string;
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

function buildScheduleSlotHref(date: Date, timeSlot: TimeSlot) {
  return `/admin/schedule/${format(date, "yyyy-MM-dd")}/${timeSlot}`;
}

function getCompactSlotSummary(input: {
  pairCount: number;
  confirmedCount: number;
  needsAttentionCount: number;
}) {
  if (!input.pairCount) {
    return {
      label: "Disponible",
      className: "border-border/70 bg-secondary/35 text-secondary-foreground"
    };
  }

  if (input.confirmedCount === input.pairCount) {
    return {
      label: input.pairCount === 1 ? "Confirmada" : "Confirmadas",
      className: "border-success/25 bg-success/15 text-success"
    };
  }

  if (input.confirmedCount === 0) {
    return {
      label: input.needsAttentionCount ? "Sin confirmar" : "Pendiente",
      className: "border-warning/25 bg-warning/15 text-warning"
    };
  }

  return {
    label: `${input.confirmedCount}/${input.pairCount} confirmadas`,
    className: "border-primary/25 bg-primary/15 text-primary"
  };
}

export function ScheduleSlotPreview({
  assignments,
  compact = false,
  date,
  timeSlot
}: ScheduleSlotPreviewProps) {
  const slotHref = buildScheduleSlotHref(date, timeSlot);
  const previewPairs: PreviewPair[] = assignments.flatMap((group) =>
    group.pairs.map((pair) => ({
      ...pair,
      area: group.area,
      preachingPointName: group.preachingPointName
    }))
  );
  const visiblePairs = previewPairs.slice(0, compact ? 1 : 3);
  const hiddenPairsCount = previewPairs.length - visiblePairs.length;
  const pairCount = previewPairs.length;
  const pointCount = assignments.length;
  const confirmedCount = previewPairs.filter((pair) =>
    ["CONFIRMED", "COMPLETED"].includes(pair.status)
  ).length;
  const needsAttentionCount = previewPairs.filter(
    (pair) => pair.warnings.length > 0
  ).length;
  const primaryPair = visiblePairs[0];
  const compactSummary = getCompactSlotSummary({
    pairCount,
    confirmedCount,
    needsAttentionCount
  });

  if (compact) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[88px] min-w-0 flex-col overflow-hidden rounded-lg border p-2",
          primaryPair
            ? "border-primary/20 bg-primary/[0.04]"
            : "border-border/65 bg-background/30"
        )}
      >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <p className="break-words text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-muted-foreground xl:tracking-[0.14em]">
              {pairCount
                ? `${pairCount} pareja${pairCount === 1 ? "" : "s"}`
                : "Libre"}
            </p>
          </div>
          <Link
            href={slotHref}
            aria-label="Abrir horario"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary transition hover:bg-primary/15 hover:text-primary"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {pairCount ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col justify-between">
            <div className="flex min-h-0 flex-1 items-end">
              <span
                className={cn(
                  "inline-flex min-h-7 w-full max-w-full items-center justify-center break-words rounded-md border px-2 py-1 text-center text-[10px] font-bold leading-tight tracking-[0.01em] xl:text-[11px]",
                  compactSummary.className
                )}
              >
                {compactSummary.label}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-1 items-end">
            <Link
              href={slotHref}
              className="inline-flex max-w-full break-words text-[11px] font-medium leading-tight text-primary/90 transition hover:text-primary"
            >
              Abrir horario
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-background/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Layers3 className="h-3.5 w-3.5" />
            {pairCount
              ? `${pairCount} pareja${pairCount === 1 ? "" : "s"}`
              : "Sin parejas"}
            <span className="text-border">•</span>
            {pointCount} punto{pointCount === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {pairCount
              ? needsAttentionCount
                ? `${needsAttentionCount} pareja${
                    needsAttentionCount === 1 ? "" : "s"
                  } requieren atención en este horario.`
                : "Horario operativo con parejas activas."
              : "Abre este horario para registrar la primera pareja."}
          </p>
        </div>
        <Link
          href={slotHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15 hover:text-primary"
        >
          Ver horario
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {visiblePairs.length ? (
        <div className="space-y-2">
          {visiblePairs.map((pair) => (
            <Link
              key={pair.id}
              href={`/admin/assignments/${pair.id}`}
              className="group flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5 transition hover:border-primary/30 hover:bg-background/50"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {pair.preachingPointName}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {pair.area}
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Users2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {pair.volunteerNames.length
                    ? pair.volunteerNames.join(" y ")
                    : "Esperando asignación de voluntarios"}
                </p>
              </div>
              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
            </Link>
          ))}

          {hiddenPairsCount > 0 ? (
            <Link
              href={slotHref}
              className="inline-flex text-xs font-semibold text-primary transition hover:text-primary/80"
            >
              +{hiddenPairsCount} pareja{hiddenPairsCount === 1 ? "" : "s"} más
              en este horario
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/35 px-3 py-3 text-xs text-muted-foreground">
          Sin parejas asignadas todavía.
        </div>
      )}
    </div>
  );
}
