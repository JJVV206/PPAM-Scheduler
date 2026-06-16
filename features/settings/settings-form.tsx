"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateSettingsSchema } from "@/lib/validations/settings";
import type { SettingsDto } from "@/types/domain";

type SettingsFormValues = z.infer<typeof updateSettingsSchema>;
type NumberSettingName =
  | "confirmationLeadDays"
  | "finalReminderHours"
  | "primaryResponseTimeoutHours"
  | "replacementResponseTimeoutHours"
  | "censusResponseTimeoutHours"
  | "urgentThresholdHours";
type NumberListSettingName =
  | "reminderTimingDays"
  | "primaryReminderOffsetsHours"
  | "replacementReminderOffsetsHours"
  | "censusReminderOffsetsHours";

type SettingsFormProps = {
  initialValues: SettingsDto;
};

function parseNumberList(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

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
    const payload: SettingsFormValues = {
      ...values,
      notificationChannels: values.notificationChannels?.length
        ? values.notificationChannels
        : initialValues.notificationChannels
    };
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (response.ok) {
      form.reset(result);
    }

    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok ? "Configuración actualizada." : result.error
    });
  }

  function NumberSettingField({
    label,
    name
  }: {
    label: string;
    name: NumberSettingName;
  }) {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <Input
                min={1}
                type="number"
                {...field}
                onChange={(event) => field.onChange(Number(event.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  function NumberListSettingField({
    label,
    name,
    placeholder
  }: {
    label: string;
    name: NumberListSettingName;
    placeholder: string;
  }) {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <Input
                inputMode="numeric"
                placeholder={placeholder}
                value={field.value.join(", ")}
                onChange={(event) =>
                  field.onChange(parseNumberList(event.target.value))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  return (
    <Card className="surface-elevated">
      <CardHeader>
        <CardTitle>Valores operativos</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <NumberSettingField
                label="Días para solicitar confirmación"
                name="confirmationLeadDays"
              />
              <NumberSettingField
                label="Umbral urgente (horas)"
                name="urgentThresholdHours"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Titular</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberSettingField
                  label="Tiempo de respuesta (horas)"
                  name="primaryResponseTimeoutHours"
                />
                <NumberListSettingField
                  label="Recordatorios (horas)"
                  name="primaryReminderOffsetsHours"
                  placeholder="12, 24, 40"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Suplente</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberSettingField
                  label="Tiempo de respuesta (horas)"
                  name="replacementResponseTimeoutHours"
                />
                <NumberListSettingField
                  label="Recordatorios (horas)"
                  name="replacementReminderOffsetsHours"
                  placeholder="4, 8"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Turno</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberListSettingField
                  label="Recordatorios (días)"
                  name="reminderTimingDays"
                  placeholder="5, 1"
                />
                <NumberSettingField
                  label="Recordatorio final (horas)"
                  name="finalReminderHours"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Censo</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberSettingField
                  label="Tiempo de respuesta (horas)"
                  name="censusResponseTimeoutHours"
                />
                <NumberListSettingField
                  label="Recordatorios (horas)"
                  name="censusReminderOffsetsHours"
                  placeholder="24, 48"
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="adminAlertEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email de alerta admin</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">
              <Save className="h-4 w-4" />
              Guardar configuración
            </Button>
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
