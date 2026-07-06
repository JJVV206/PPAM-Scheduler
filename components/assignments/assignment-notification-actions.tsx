"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  buildAssignmentNotificationFeedback,
  buildAssignmentNotificationNetworkErrorFeedback
} from "@/lib/notifications/assignment-notification-feedback";

type AssignmentNotificationActionsProps = {
  assignmentId: string;
  disabled?: boolean;
  compact?: boolean;
};

export function AssignmentNotificationActions({
  assignmentId,
  disabled,
  compact = false
}: AssignmentNotificationActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"request" | "reminder" | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function trigger(kind: "request" | "reminder") {
    setLoading(kind);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/notifications/${kind}`,
        {
          method: "POST"
        }
      );
      const nextFeedback = await buildAssignmentNotificationFeedback(
        response,
        kind
      );

      setFeedback(nextFeedback);

      if (response.ok) {
        router.refresh();
      }
    } catch {
      setFeedback(buildAssignmentNotificationNetworkErrorFeedback());
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      <div className="grid gap-2">
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          onClick={() => trigger("request")}
          disabled={disabled || loading !== null}
        >
          {loading === "request"
            ? "Enviando..."
            : "Enviar invitación pendiente"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size={compact ? "sm" : "default"}
          onClick={() => trigger("reminder")}
          disabled={disabled || loading !== null}
        >
          {loading === "reminder" ? "Reenviando..." : "Reenviar email"}
        </Button>
      </div>
      <FeedbackMessage
        className={compact ? "text-xs" : undefined}
        message={feedback?.text}
        tone={feedback?.tone}
      />
    </div>
  );
}
