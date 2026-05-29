"use client";

import { useState } from "react";
import { CheckCircle2, CircleOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";

type ConfirmationCardProps = {
  assignmentId: string;
  pointName: string;
  date: Date;
  timeSlot: import("@/types/domain").TimeSlot;
};

export function ConfirmationCard({
  assignmentId,
  pointName,
  date,
  timeSlot
}: ConfirmationCardProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"confirm" | "decline" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function respond(intent: "confirm" | "decline") {
    setSubmitting(intent);
    setMessage(null);
    const response = await fetch(`/api/assignments/${assignmentId}/${intent}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ note })
    });
    const result = await response.json();
    setMessage(response.ok ? `Response saved as ${intent}.` : result.error);
    setSubmitting(null);
  }

  return (
    <Card className="surface-elevated mx-auto max-w-xl">
      <CardContent className="space-y-6 p-8">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
            Assignment Confirmation
          </p>
          <h1 className="font-heading text-4xl font-semibold text-balance">
            You have been assigned to {formatDisplayDate(date, "EEEE")}{" "}
            {TIME_SLOT_DEFINITIONS[timeSlot].label} at {pointName}.
          </h1>
        </div>
        <div className="rounded-3xl bg-background/60 p-5 text-sm text-muted-foreground">
          <p>{formatDisplayDate(date, "EEEE, MMMM d")}</p>
          <p>{TIME_SLOT_DEFINITIONS[timeSlot].label}</p>
          <p>{pointName}</p>
        </div>
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note"
        />
        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={() => respond("confirm")}
            disabled={submitting !== null}
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting === "confirm" ? "Saving..." : "I'll be there"}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            size="lg"
            onClick={() => respond("decline")}
            disabled={submitting !== null}
          >
            <CircleOff className="h-4 w-4" />
            {submitting === "decline" ? "Saving..." : "I can't attend"}
          </Button>
        </div>
        {message ? <p className="text-center text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
