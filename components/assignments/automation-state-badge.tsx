import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AssignmentAutomationState } from "@/types/domain";

type AutomationStateBadgeProps = {
  state: AssignmentAutomationState;
  className?: string;
};

const toneVariants: Record<
  AssignmentAutomationState["tone"],
  "default" | "secondary" | "success" | "warning" | "danger" | "outline"
> = {
  neutral: "secondary",
  info: "default",
  success: "success",
  warning: "warning",
  danger: "danger"
};

export function AutomationStateBadge({
  state,
  className
}: AutomationStateBadgeProps) {
  return (
    <Badge
      variant={toneVariants[state.tone]}
      className={cn("max-w-full text-center leading-tight", className)}
    >
      {state.label}
    </Badge>
  );
}
