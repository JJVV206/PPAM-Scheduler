"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type AssignmentNotificationActionsProps = {
  assignmentId: string;
  disabled?: boolean;
};

export function AssignmentNotificationActions({
  assignmentId,
  disabled
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
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          onClick={() => trigger("request")}
          disabled={disabled || loading !== null}
        >
          {loading === "request" ? "Enviando..." : "Solicitar confirmación"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => trigger("reminder")}
          disabled={disabled || loading !== null}
        >
          {loading === "reminder" ? "Reenviando..." : "Reenviar recordatorio"}
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
