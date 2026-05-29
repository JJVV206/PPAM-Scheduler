"use client";

import { useState } from "react";
import { MapPin, TriangleAlert, Users2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
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
  const [selectedVolunteerId, setSelectedVolunteerId] = useState(
    currentVolunteerId ?? openSlot.suggestedVolunteers[0]?.id ?? ""
  );
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAssign() {
    setSubmitting(true);
    setMessage(null);
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
    setMessage(response.ok ? "Slot covered. Refresh to see updates." : result.error);
    setSubmitting(false);
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
          <p>{formatDisplayDate(openSlot.date, "EEEE, MMM d")}</p>
          <p>{TIME_SLOT_DEFINITIONS[openSlot.timeSlot].label}</p>
          <p className="flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            Missing {openSlot.missingPositions.join(" & ")}
          </p>
          {openSlot.notes ? (
            <p className="rounded-2xl bg-white/[0.03] p-3 text-foreground">{openSlot.notes}</p>
          ) : null}
        </div>
        {mode === "admin" ? (
          <div className="space-y-3">
            <Select value={selectedVolunteerId} onValueChange={setSelectedVolunteerId}>
              <SelectTrigger>
                <SelectValue placeholder="Assign volunteer" />
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
              {submitting ? "Assigning..." : "Assign Replacement"}
            </Button>
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={handleAssign}
            disabled={!selectedVolunteerId || submitting}
          >
            {submitting ? "Accepting..." : "Accept Assignment"}
          </Button>
        )}
        {message ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="h-4 w-4" />
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
