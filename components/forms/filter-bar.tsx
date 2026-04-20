import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "surface-panel flex flex-col gap-3 rounded-3xl p-4 md:flex-row md:items-center",
        className
      )}
    >
      {children}
    </div>
  );
}
