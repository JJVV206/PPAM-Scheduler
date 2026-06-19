import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "surface-panel flex min-h-44 flex-col items-center justify-center gap-2.5 p-6 text-center",
        className
      )}
    >
      <h3 className="font-heading text-xl font-semibold">{title}</h3>
      <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
