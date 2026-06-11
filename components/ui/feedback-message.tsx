"use client";

import type { ComponentType } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type FeedbackTone = "error" | "success" | "info" | "warning";

type FeedbackMessageProps = {
  message?: string | null;
  tone?: FeedbackTone;
  className?: string;
};

const toneMap: Record<
  FeedbackTone,
  { container: string; icon: ComponentType<{ className?: string }> }
> = {
  error: {
    container: "border-danger/20 bg-danger/10 text-danger",
    icon: AlertCircle
  },
  success: {
    container: "border-success/20 bg-success/10 text-success",
    icon: CheckCircle2
  },
  info: {
    container: "border-primary/15 bg-primary/10 text-primary",
    icon: Info
  },
  warning: {
    container: "border-warning/20 bg-warning/10 text-warning",
    icon: AlertCircle
  }
};

export function FeedbackMessage({
  message,
  tone = "info",
  className
}: FeedbackMessageProps) {
  if (!message) {
    return null;
  }

  const Icon = toneMap[tone].icon;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm",
        toneMap[tone].container,
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

export type { FeedbackTone };
