import { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type DashboardStatCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
};

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  hint
}: DashboardStatCardProps) {
  return (
    <Card className="surface-elevated">
      <CardContent className="flex items-start justify-between gap-4 p-5 xl:p-6">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground xl:text-xs xl:tracking-[0.22em]">
            {label}
          </p>
          <p className="font-heading text-3xl font-semibold xl:text-4xl">{value}</p>
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="rounded-2xl bg-primary/15 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
