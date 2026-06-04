"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  TIME_SLOTS,
  TIME_SLOT_DEFINITIONS
} from "@/lib/constants/domain";
import type { PreachingPointSummary } from "@/types/domain";
import { useRouter } from "next/navigation";

type PointFormDialogProps = {
  point?: PreachingPointSummary;
  trigger: React.ReactNode;
};

export function PointFormDialog({ point, trigger }: PointFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(point?.name ?? "");
  const [area, setArea] = useState(point?.area ?? "");
  const [notes, setNotes] = useState(point?.notes ?? "");
  const [active, setActive] = useState(point?.active ?? true);
  const [selectedSlots, setSelectedSlots] = useState(
    new Set(
      (point?.activeSlots ?? []).map(
        (slot) => `${slot.dayOfWeek}:${slot.timeSlot}`
      )
    )
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isEditing = Boolean(point);

  const activeSlots = useMemo(
    () =>
      Array.from(selectedSlots).map((value) => {
        const [dayOfWeek, timeSlot] = value.split(":");
        return {
          dayOfWeek,
          timeSlot
        };
      }),
    [selectedSlots]
  );

  function toggleSlot(dayOfWeek: string, timeSlot: string, checked: boolean) {
    const next = new Set(selectedSlots);
    const key = `${dayOfWeek}:${timeSlot}`;

    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }

    setSelectedSlots(next);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);

    const response = await fetch(
      isEditing ? `/api/points/${point?.id}` : "/api/points",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          area,
          notes,
          active,
          activeSlots
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "No fue posible guardar el punto.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Editar punto de predicación"
              : "Crear punto de predicación"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="point-name">Nombre</Label>
              <Input
                id="point-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="point-area">Área</Label>
              <Input
                id="point-area"
                value={area}
                onChange={(event) => setArea(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="point-notes">Notas</Label>
              <Textarea
                id="point-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Indicaciones operativas opcionales"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
              <div>
                <p className="font-medium">Punto activo</p>
                <p className="text-sm text-muted-foreground">
                  Desactívalo si no debe aparecer en el flujo operativo.
                </p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-primary/8 rounded-2xl border border-primary/15 px-4 py-3 text-sm text-muted-foreground">
              Si dejas este bloque vacío, el punto quedará temporalmente
              disponible en cualquier día y franja. Si defines slots activos,
              solo se podrá asignar en esas combinaciones.
            </div>

            <div className="space-y-4">
              {DAYS_OF_WEEK.map((dayOfWeek) => (
                <div
                  key={dayOfWeek}
                  className="rounded-2xl bg-white/[0.03] p-4"
                >
                  <p className="mb-3 font-semibold">{DAY_LABELS[dayOfWeek]}</p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {TIME_SLOTS.map((timeSlot) => {
                      const key = `${dayOfWeek}:${timeSlot}`;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/35 px-4 py-3"
                        >
                          <Checkbox
                            checked={selectedSlots.has(key)}
                            onCheckedChange={(checked) =>
                              toggleSlot(dayOfWeek, timeSlot, checked === true)
                            }
                          />
                          <span className="text-sm">
                            {TIME_SLOT_DEFINITIONS[timeSlot].shortLabel}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !area.trim()}
          >
            {submitting
              ? "Guardando..."
              : isEditing
                ? "Guardar cambios"
                : "Crear punto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
