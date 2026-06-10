"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Users2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  TIME_SLOT_DEFINITIONS,
  VOLUNTEER_POSITION_LABELS
} from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import type { OpenSlotDto } from "@/types/domain";

type OpenSlotCardProps = {
  openSlot: OpenSlotDto;
  mode: "admin" | "volunteer";
  currentVolunteerId?: string;
};

export function OpenSlotCard({
  openSlot,
  mode,
  currentVolunteerId
}: OpenSlotCardProps) {
  const router = useRouter();
  const [selectedVolunteerId, setSelectedVolunteerId] = useState(
    currentVolunteerId ?? openSlot.suggestedVolunteers[0]?.id ?? ""
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedVolunteer = useMemo(
    () =>
      openSlot.suggestedVolunteers.find(
        (volunteer) => volunteer.id === selectedVolunteerId
      ),
    [openSlot.suggestedVolunteers, selectedVolunteerId]
  );

  async function handleAssign() {
    setSubmitting(true);
    setFeedback(null);
    const response = await fetch("/api/open-slots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        assignmentId: openSlot.assignmentId,
        volunteerId: selectedVolunteerId
      })
    });
    const result = await response.json();
    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok ? "Vacante cubierta." : result.error
    });
    setSubmitting(false);

    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <Card className="surface-elevated">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-heading text-2xl font-semibold">
              {openSlot.preachingPointName}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {openSlot.area}
            </p>
          </div>
          <div className="rounded-full bg-danger/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-danger">
            {openSlot.urgencyLabel}
          </div>
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground">
          <p>{formatDisplayDate(openSlot.date, "EEEE d 'de' MMM")}</p>
          <p>{TIME_SLOT_DEFINITIONS[openSlot.timeSlot].label}</p>
          <p className="flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            Faltan{" "}
            {openSlot.missingPositions
              .map((position) => VOLUNTEER_POSITION_LABELS[position])
              .join(" y ")}
          </p>
          {openSlot.notes ? (
            <p className="rounded-2xl bg-white/[0.03] p-3 text-foreground">
              {openSlot.notes}
            </p>
          ) : null}
        </div>
        {mode === "admin" ? (
          <div className="space-y-3">
            <Select
              value={selectedVolunteerId}
              onValueChange={setSelectedVolunteerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Asignar voluntario" />
              </SelectTrigger>
              <SelectContent>
                {openSlot.suggestedVolunteers.map((volunteer) => (
                  <SelectItem key={volunteer.id} value={volunteer.id}>
                    {volunteer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              onClick={handleAssign}
              disabled={!selectedVolunteerId || submitting}
            >
              {submitting ? "Asignando..." : "Asignar reemplazo"}
            </Button>
            {selectedVolunteer ? (
              <div className="rounded-2xl bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                {selectedVolunteer.preferredAreas.includes(openSlot.area)
                  ? "Elegible por preferencia de zona y disponibilidad."
                  : "Elegible por disponibilidad en esta franja y sin conflicto activo."}{" "}
                Confiabilidad: {Math.round(selectedVolunteer.reliabilityScore)}
                %.
              </div>
            ) : null}
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={handleAssign}
            disabled={!selectedVolunteerId || submitting}
          >
            {submitting ? "Aceptando..." : "Aceptar asignación"}
          </Button>
        )}
        <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />
      </CardContent>
    </Card>
  );
}
