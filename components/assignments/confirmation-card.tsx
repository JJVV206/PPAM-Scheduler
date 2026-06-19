"use client";

import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleOff,
  Clock3,
  MapPin
} from "lucide-react";

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
  const [completedIntent, setCompletedIntent] = useState<
    "confirm" | "decline" | null
  >(null);
  const isReplacementInvitation = invitationType === "REPLACEMENT";
  const title = isReplacementInvitation
    ? "¿Puedes cubrir este turno?"
    : "Confirma tu asistencia";
  const intro = isReplacementInvitation
    ? "Te invitaron como suplente. Responde si puedes cubrir esta asignación."
    : "Revisa los datos del turno y responde si podrás asistir.";
  const completedText =
    completedIntent === "confirm"
      ? "Tu asistencia quedó confirmada. Puedes cerrar esta pantalla."
      : "Registramos que no puedes asistir. Se buscará cobertura si hace falta.";

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
          ? "Respuesta guardada: confirmaste tu asistencia."
          : "Respuesta guardada: avisaste que no puedes asistir."
        : (result.error ?? "No fue posible guardar tu respuesta.")
    });
    setCompleted(response.ok);
    setCompletedIntent(response.ok ? intent : null);
    setSubmitting(null);
  }

  return (
    <Card className="surface-elevated mx-auto max-w-xl">
      <CardContent className="space-y-5 p-5 sm:p-8">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {isReplacementInvitation
              ? "Invitación de suplente"
              : "Confirmación de asignación"}
          </p>
          <h1 className="text-balance font-heading text-3xl font-semibold sm:text-4xl">
            {title}
          </h1>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
            {intro}
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Fecha
            </p>
            <p className="mt-1 font-medium">
              {formatDisplayDate(date, "EEEE d 'de' MMMM")}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Horario
            </p>
            <p className="mt-1 font-medium">
              {TIME_SLOT_DEFINITIONS[timeSlot].label}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Punto
            </p>
            <p className="mt-1 font-medium">{pointName}</p>
          </div>
        </div>

        {completed ? (
          <div className="rounded-lg border border-success/35 bg-success/[0.08] px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              Respuesta registrada.
            </span>{" "}
            {completedText}
          </div>
        ) : (
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background/35 px-3 py-2">
              <span className="font-semibold text-foreground">
                Si confirmas:
              </span>{" "}
              el turno queda registrado como confirmado.
            </div>
            <div className="rounded-lg border border-border/70 bg-background/35 px-3 py-2">
              <span className="font-semibold text-foreground">
                Si no puedes:
              </span>{" "}
              se avisará para buscar cobertura.
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Motivo o nota opcional
          </label>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Ej. Estoy fuera, tuve un imprevisto o puedo llegar unos minutos tarde."
            disabled={completed}
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
            {submitting === "confirm" ? "Guardando..." : "Confirmar"}
          </Button>
          <Button
            variant="danger"
            className="w-full"
            size="lg"
            onClick={() => respond("decline")}
            disabled={completed || submitting !== null}
          >
            <CircleOff className="h-4 w-4" />
            {submitting === "decline" ? "Guardando..." : "No puedo asistir"}
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
