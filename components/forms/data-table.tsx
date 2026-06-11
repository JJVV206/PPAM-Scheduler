import { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DataTableProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DataTable({
  title,
  description,
  actions,
  children,
  className
}: DataTableProps) {
  return (
    <Card className={cn(className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            {title ? (
              <h1 className="font-heading text-xl font-semibold tracking-tight">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
