"use client";

import { useState } from "react";
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

export function CreateVolunteerForm() {
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
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

  async function onSubmit(values: VolunteerFormValues) {
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
      if (result.warning) {
        setFeedback({
          tone: "warning",
          text: result.warning
        });
      } else {
        setFeedback(null);
        setOpen(false);
      }
      return;
    }

    if (response.status === 409) {
      form.setError("email", {
        type: "server",
        message: result.error ?? "Ese correo ya está registrado."
      });
      return;
    }

    setFeedback({
      tone: "error",
      text: result.error ?? "No se pudo guardar el voluntario."
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          form.reset();
          form.clearErrors();
          setFeedback(null);
        }
      }}
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
            <Button type="submit" className="w-full">
              Guardar voluntario
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
