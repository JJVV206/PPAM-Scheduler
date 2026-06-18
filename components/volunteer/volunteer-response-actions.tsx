"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Textarea } from "@/components/ui/textarea";
import type { ResponseStatus } from "@/types/domain";

type VolunteerResponseActionsProps = {
  responseId: string;
  currentStatus: ResponseStatus;
  initialNote?: string | null;
  compact?: boolean;
};

const responseStatusLabels: Record<ResponseStatus, string> = {
  PENDING: "Pendiente de respuesta",
  CONFIRMED: "Confirmada",
  DECLINED: "Rechazada"
};

const responseHelpText: Record<ResponseStatus, string> = {
  PENDING:
    "Confirma si asistirás. Si no puedes, avisa aquí para que se busque cobertura.",
  CONFIRMED: "Tu asistencia ya quedó confirmada para este turno.",
  DECLINED:
    "Ya avisaste que no podrás asistir. Tu nota ayuda a entender el motivo."
};

export function VolunteerResponseActions({
  responseId,
  currentStatus,
  initialNote,
  compact = false
}: VolunteerResponseActionsProps) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [submitting, setSubmitting] = useState<"confirm" | "decline" | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function respond(intent: "confirm" | "decline") {
    setSubmitting(intent);
    setFeedback(null);

    const response = await fetch(
      `/api/assignment-responses/${responseId}/${intent}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ note: note.trim() || undefined })
      }
    );
    const result = await response.json();

    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? intent === "confirm"
          ? "Respuesta guardada: sí podrás asistir."
          : "Respuesta guardada: no podrás asistir."
        : result.error
    });
    setSubmitting(null);

    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      <div className="rounded-lg border border-border/70 bg-background/35 px-3 py-2 text-sm text-muted-foreground">
        {responseHelpText[currentStatus]}
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Motivo o nota opcional
        </label>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={compact ? 2 : 3}
          placeholder="Ej. Estoy fuera, tuve un imprevisto o puedo llegar unos minutos tarde."
          className={compact ? "min-h-[72px]" : undefined}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          onClick={() => respond("confirm")}
          disabled={submitting !== null || currentStatus === "CONFIRMED"}
        >
          <CheckCircle2 className="h-4 w-4" />
          {submitting === "confirm" ? "Guardando..." : "Confirmar"}
        </Button>
        <Button
          type="button"
          variant="danger"
          size={compact ? "sm" : "default"}
          onClick={() => respond("decline")}
          disabled={submitting !== null || currentStatus === "DECLINED"}
        >
          <CircleOff className="h-4 w-4" />
          {submitting === "decline" ? "Guardando..." : "No puedo asistir"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Estado actual: {responseStatusLabels[currentStatus]}.
      </p>
      <FeedbackMessage
        className={compact ? "text-xs" : undefined}
        message={feedback?.text}
        tone={feedback?.tone}
      />
    </div>
  );
}
