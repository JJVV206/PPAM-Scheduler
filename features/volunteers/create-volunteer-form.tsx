"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createVolunteerSchema } from "@/lib/validations/volunteer";

type VolunteerFormValues = z.infer<typeof createVolunteerSchema>;

const SUCCESS_CLOSE_DELAY_MS = 900;

export function CreateVolunteerForm() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const form = useForm<VolunteerFormValues>({
    resolver: zodResolver(createVolunteerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "VOLUNTEER",
      notes: "",
      transportationNotes: "",
      preferredAreas: [],
      active: true
    }
  });

  function clearCloseTimeout() {
    if (!closeTimeoutRef.current) return;
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
  }

  useEffect(() => {
    return () => clearCloseTimeout();
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      clearCloseTimeout();
      form.reset();
      form.clearErrors();
      setFeedback(null);
    }

    setOpen(nextOpen);
  }

  async function onSubmit(values: VolunteerFormValues) {
    setSubmitting(true);
    setFeedback(null);
    form.clearErrors();

    const response = await fetch("/api/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const result = await response.json();

    if (response.ok) {
      form.reset();
      router.refresh();
      setFeedback({
        tone: result.warning ? "warning" : "success",
        text: result.warning
          ? `${result.warning} Cerrando ventana...`
          : "Voluntario creado. Cerrando ventana..."
      });
      clearCloseTimeout();
      closeTimeoutRef.current = window.setTimeout(() => {
        setOpen(false);
        setFeedback(null);
        closeTimeoutRef.current = null;
      }, SUCCESS_CLOSE_DELAY_MS);
      setSubmitting(false);
      return;
    }

    if (response.status === 409) {
      form.setError("email", {
        type: "server",
        message: result.error ?? "Ese correo ya está registrado."
      });
      setSubmitting(false);
      return;
    }

    setFeedback({
      tone: "error",
      text: result.error ?? "No se pudo guardar el voluntario."
    });
    setSubmitting(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button>Agregar voluntario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar voluntario</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FeedbackMessage
              message={feedback?.text}
              tone={feedback?.tone}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar voluntario"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
