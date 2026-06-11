"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateSettingsSchema } from "@/lib/validations/settings";
import type { SettingsDto } from "@/types/domain";

type SettingsFormValues = z.infer<typeof updateSettingsSchema>;

type SettingsFormProps = {
  initialValues: SettingsDto;
};

export function SettingsForm({ initialValues }: SettingsFormProps) {
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: initialValues
  });

  async function onSubmit(values: SettingsFormValues) {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const result = await response.json();
    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok ? "Configuración actualizada." : result.error
    });
  }

  return (
    <Card className="surface-elevated">
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="confirmationLeadDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Días de anticipación para confirmar</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reminderTimingDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Días para recordatorios</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value.join(", ")}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value
                            .split(",")
                            .map((item) => Number(item.trim()))
                            .filter((item) => !Number.isNaN(item))
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Guardar configuración</Button>
          </form>
        </Form>
        <FeedbackMessage
          className="mt-3"
          message={feedback?.text}
          tone={feedback?.tone}
        />
      </CardContent>
    </Card>
  );
}
