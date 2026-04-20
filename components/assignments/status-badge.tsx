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
  SCHEDULED: { label: "Scheduled", variant: "secondary" },
  PENDING_CONFIRMATION: { label: "Pending", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  DECLINED: { label: "Declined", variant: "danger" },
  NEEDS_REPLACEMENT: { label: "Needs Replacement", variant: "danger" },
  REASSIGNED: { label: "Reassigned", variant: "default" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
  PENDING: { label: "Pending", variant: "warning" }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
