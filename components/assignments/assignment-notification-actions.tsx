"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

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
  const [message, setMessage] = useState<string | null>(null);

  async function trigger(kind: "request" | "reminder") {
    setLoading(kind);
    setMessage(null);

    const response = await fetch(
      `/api/assignments/${assignmentId}/notifications/${kind}`,
      {
        method: "POST"
      }
    );
    const result = await response.json();

    setLoading(null);
    setMessage(
      response.ok
        ? kind === "request"
          ? `Solicitudes enviadas (${result.sentCount}).`
          : `Recordatorios reenviados (${result.sentCount}).`
        : result.error ?? "No fue posible completar la acción."
    );

    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          onClick={() => trigger("request")}
          disabled={disabled || loading !== null}
        >
          {loading === "request" ? "Enviando..." : "Solicitar confirmación"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size={compact ? "sm" : "default"}
          onClick={() => trigger("reminder")}
          disabled={disabled || loading !== null}
        >
          {loading === "reminder" ? "Reenviando..." : "Reenviar recordatorio"}
        </Button>
      </div>
      {message ? (
        <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
