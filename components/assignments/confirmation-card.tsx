"use client";

import { useState } from "react";
import { CheckCircle2, CircleOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Textarea } from "@/components/ui/textarea";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";

type ConfirmationCardProps = {
  assignmentId?: string;
  responseId?: string;
  invitationToken?: string;
  invitationType?: "PRIMARY" | "REPLACEMENT";
  pointName: string;
  date: Date;
  timeSlot: import("@/types/domain").TimeSlot;
};

export function ConfirmationCard({
  assignmentId,
  responseId,
  invitationToken,
  invitationType = "PRIMARY",
  pointName,
  date,
  timeSlot
}: ConfirmationCardProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"confirm" | "decline" | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [completed, setCompleted] = useState(false);
  const isReplacementInvitation = invitationType === "REPLACEMENT";

  async function respond(intent: "confirm" | "decline") {
    setSubmitting(intent);
    setFeedback(null);
    const normalizedNote = note.trim();
    const endpoint = invitationToken
      ? `/api/assignment-invitations/${encodeURIComponent(invitationToken)}/${intent}`
      : responseId
        ? `/api/assignment-responses/${responseId}/${intent}`
        : `/api/assignments/${assignmentId}/${intent}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ note: normalizedNote || undefined })
    });
    const result = await response.json();
    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? intent === "confirm"
          ? "Respuesta guardada: sí podrás asistir."
          : "Respuesta guardada: no podrás asistir."
        : result.error
    });
    setCompleted(response.ok);
    setSubmitting(null);
  }

  return (
    <Card className="surface-elevated mx-auto max-w-xl">
      <CardContent className="space-y-6 p-8">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
            {isReplacementInvitation
              ? "Invitación de suplente"
              : "Confirmación de asignación"}
          </p>
          <h1 className="text-balance font-heading text-4xl font-semibold">
            {isReplacementInvitation
              ? "Puedes cubrir como suplente el "
              : "Tienes una asignación para el "}
            {formatDisplayDate(date, "EEEE")} en el horario{" "}
            {TIME_SLOT_DEFINITIONS[timeSlot].label} en {pointName}.
          </h1>
        </div>
        <div className="rounded-3xl bg-background/60 p-5 text-sm text-muted-foreground">
          <p>{formatDisplayDate(date, "EEEE d 'de' MMMM")}</p>
          <p>{TIME_SLOT_DEFINITIONS[timeSlot].label}</p>
          <p>{pointName}</p>
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Nota opcional
          </label>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Agrega una nota breve si hace falta."
          />
        </div>
        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={() => respond("confirm")}
            disabled={completed || submitting !== null}
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting === "confirm" ? "Guardando..." : "Sí podré asistir"}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            size="lg"
            onClick={() => respond("decline")}
            disabled={completed || submitting !== null}
          >
            <CircleOff className="h-4 w-4" />
            {submitting === "decline" ? "Guardando..." : "No podré asistir"}
          </Button>
        </div>
        <FeedbackMessage
          className="justify-center text-center"
          message={feedback?.text}
          tone={feedback?.tone}
        />
      </CardContent>
    </Card>
  );
}
