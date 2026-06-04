import { Badge } from "@/components/ui/badge";
import type { AssignmentStatus, ResponseStatus } from "@/types/domain";

type StatusBadgeProps = {
  status: AssignmentStatus | ResponseStatus;
};

const statusMap: Record<
  StatusBadgeProps["status"],
  {
    label: string;
    variant: "default" | "secondary" | "success" | "warning" | "danger" | "outline";
  }
> = {
  SCHEDULED: { label: "Programada", variant: "secondary" },
  PENDING_CONFIRMATION: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmada", variant: "success" },
  DECLINED: { label: "Rechazada", variant: "danger" },
  NEEDS_REPLACEMENT: { label: "Requiere reemplazo", variant: "danger" },
  REASSIGNED: { label: "Reasignada", variant: "default" },
  COMPLETED: { label: "Completada", variant: "success" },
  CANCELLED: { label: "Cancelada", variant: "outline" },
  PENDING: { label: "Pendiente", variant: "warning" }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
