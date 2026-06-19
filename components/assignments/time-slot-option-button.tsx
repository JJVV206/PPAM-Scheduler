"use client";

import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { cn } from "@/lib/utils";
import type { TimeSlot } from "@/types/domain";

type TimeSlotOptionButtonProps = {
  slot: TimeSlot;
  selected: boolean;
  onClick: () => void;
  className?: string;
  dense?: boolean;
};

export function TimeSlotOptionButton({
  slot,
  selected,
  onClick,
  className,
  dense = false
}: TimeSlotOptionButtonProps) {
  const { label, start, end } = TIME_SLOT_DEFINITIONS[slot];

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-lg border text-center transition-colors",
        dense ? "px-2.5 py-2.5" : "px-3 py-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
        selected
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center",
          dense ? "min-h-[56px] gap-1" : "min-h-[72px] gap-1.5"
        )}
      >
        <span
          className={cn(
            "font-semibold tabular-nums leading-none text-inherit",
            dense ? "text-sm lg:text-[15px]" : "text-[15px] lg:text-base"
          )}
        >
          {start}
        </span>
        <span
          className={cn(
            "bg-current/25 rounded-full",
            dense ? "h-px w-5" : "h-px w-6"
          )}
        />
        <span
          className={cn(
            "font-semibold tabular-nums leading-none text-inherit",
            dense ? "text-sm lg:text-[15px]" : "text-[15px] lg:text-base"
          )}
        >
          {end}
        </span>
      </div>
    </button>
  );
}
