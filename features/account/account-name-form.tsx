"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountNameFormProps = {
  initialName: string;
};

export function AccountNameForm({ initialName }: AccountNameFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const trimmedName = name.trim();
  const unchanged = trimmedName === initialName.trim();
  const invalid = trimmedName.length < 2 || trimmedName.length > 120;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (invalid || unchanged) return;

    setSaving(true);
    setFeedback(null);

    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName })
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    setSaving(false);

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result?.error ?? "No se pudo actualizar el nombre."
      });
      return;
    }

    setFeedback({
      tone: "success",
      text: "Nombre actualizado."
    });
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-lg border border-border/70 bg-white/[0.03] p-4"
    >
      <div className="space-y-2">
        <Label htmlFor="account-name">Nombre de la cuenta</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoComplete="name"
        />
        <p className="text-xs text-muted-foreground">
          Este nombre se muestra en tu cuenta y en la gestión interna.
        </p>
      </div>

      <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />

      <Button type="submit" disabled={saving || invalid || unchanged}>
        <Save className="h-4 w-4" />
        {saving ? "Guardando..." : "Guardar nombre"}
      </Button>
    </form>
  );
}
