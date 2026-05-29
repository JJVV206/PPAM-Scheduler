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
      <CardContent className="flex items-start justify-between p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {label}
          </p>
          <p className="font-heading text-4xl font-semibold">{value}</p>
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="rounded-2xl bg-primary/15 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
