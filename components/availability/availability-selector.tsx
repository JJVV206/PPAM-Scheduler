"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DAYS_OF_WEEK, DAY_LABELS, TIME_SLOT_DEFINITIONS, TIME_SLOTS } from "@/lib/constants/domain";
import type { DayOfWeek, TimeSlot } from "@/types/domain";

type AvailabilitySelectorProps = {
  volunteerId: string;
  initialAvailability: Array<{
    dayOfWeek: DayOfWeek;
    timeSlot: TimeSlot;
  }>;
  initialTemporaryUnavailable: boolean;
};

export function AvailabilitySelector({
  volunteerId,
  initialAvailability,
  initialTemporaryUnavailable
}: AvailabilitySelectorProps) {
  const [selected, setSelected] = useState(
    new Set(initialAvailability.map((item) => `${item.dayOfWeek}:${item.timeSlot}`))
  );
  const [temporaryUnavailable, setTemporaryUnavailable] = useState(
    initialTemporaryUnavailable
  );
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(dayOfWeek: DayOfWeek, timeSlot: TimeSlot, checked: boolean) {
    const next = new Set(selected);
    const key = `${dayOfWeek}:${timeSlot}`;
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    setSelected(next);
  }

  async function save() {
    setSubmitting(true);
    setMessage(null);

    const items = Array.from(selected).map((item) => {
      const [dayOfWeek, timeSlot] = item.split(":") as [DayOfWeek, TimeSlot];
      return {
        dayOfWeek,
        timeSlot,
        available: true,
        recurring: true
      };
    });

    const response = await fetch("/api/availability", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        volunteerId,
        items,
        temporaryUnavailable
      })
    });

    const result = await response.json();
    setMessage(response.ok ? "Availability updated." : result.error);
    setSubmitting(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr,0.9fr]">
      <Card className="surface-panel">
        <CardContent className="space-y-5 p-6">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="rounded-2xl bg-white/[0.03] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{DAY_LABELS[day]}</p>
                  <p className="text-sm text-muted-foreground">Recurring weekly preference</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                {TIME_SLOTS.map((timeSlot) => {
                  const key = `${day}:${timeSlot}`;
                  return (
                    <label
                      key={timeSlot}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/30 px-4 py-3"
                    >
                      <Checkbox
                        checked={selected.has(key)}
                        onCheckedChange={(checked) =>
                          toggle(day, timeSlot, checked === true)
                        }
                      />
                      <span className="text-sm">{TIME_SLOT_DEFINITIONS[timeSlot].shortLabel}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="surface-elevated h-fit">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="font-heading text-xl font-semibold">Availability Controls</p>
            <p className="text-sm text-muted-foreground">
              Mark yourself temporarily unavailable if you need all future open slot suggestions paused.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-background/40 p-4">
            <div>
              <p className="font-medium">Temporary Unavailable</p>
              <p className="text-sm text-muted-foreground">Pause assignment suggestions</p>
            </div>
            <Switch
              checked={temporaryUnavailable}
              onCheckedChange={setTemporaryUnavailable}
            />
          </div>
          <Button className="w-full" onClick={save} disabled={submitting}>
            {submitting ? "Saving..." : "Save Preferences"}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
