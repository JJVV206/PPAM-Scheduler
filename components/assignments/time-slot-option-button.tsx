"use client";

import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { cn } from "@/lib/utils";
import type { TimeSlot } from "@/types/domain";

type TimeSlotOptionButtonProps = {
  slot: TimeSlot;
  selected: boolean;
  onClick: () => void;
  className?: string;
};

export function TimeSlotOptionButton({
  slot,
  selected,
  onClick,
  className
}: TimeSlotOptionButtonProps) {
  const { label, start, end } = TIME_SLOT_DEFINITIONS[slot];

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-3 py-3 text-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        selected
          ? "border-primary bg-primary/15 text-foreground shadow-[0_8px_24px_rgba(102,145,255,0.18)]"
          : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      <div className="flex min-h-[72px] flex-col items-center justify-center gap-1.5">
        <span className="text-[15px] font-semibold leading-none tabular-nums text-inherit lg:text-base">
          {start}
        </span>
        <span className="h-px w-6 rounded-full bg-current/25" />
        <span className="text-[15px] font-semibold leading-none tabular-nums text-inherit lg:text-base">
          {end}
        </span>
      </div>
    </button>
  );
}
