"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type DeleteVolunteerButtonProps = {
  volunteerId: string;
  volunteerName: string;
  disabled?: boolean;
};

export function DeleteVolunteerButton({
  volunteerId,
  volunteerName,
  disabled = false
}: DeleteVolunteerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(
      `/api/volunteers/${encodeURIComponent(volunteerId)}`,
      {
        method: "DELETE"
      }
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setError(result?.error ?? "No se pudo suspender el voluntario.");
      setSubmitting(false);
      return;
    }

    router.replace("/admin/volunteers");
    router.refresh();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && submitting) {
      return;
    }

    if (!nextOpen) {
      setError(null);
    }

    setOpen(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={disabled}
          aria-label={
            disabled
              ? `${volunteerName} ya está suspendido`
              : `Suspender voluntario ${volunteerName}`
          }
        >
          <UserX className="h-4 w-4" />
          {disabled ? "Suspendido" : "Suspender"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Suspender voluntario</DialogTitle>
          <DialogDescription>
            {volunteerName} quedará inactivo, no podrá iniciar sesión ni
            aparecerá como opción para nuevas asignaciones. Su historial se
            conserva para auditoría.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          Las asignaciones futuras de este voluntario se marcarán como
          pendientes de reemplazo.
        </div>

        <FeedbackMessage message={error} tone="error" />

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? "Suspendiendo..." : "Sí, suspender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
