"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema } from "@/lib/validations/auth";

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
      password: ""
    }
  });

  async function onSubmit(values: ResetPasswordValues) {
    setFeedback(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const result = await response.json();
    setFeedback({
      tone: response.ok ? "success" : "error",
      text:
        response.ok
          ? "Contraseña actualizada. Ya puedes iniciar sesión."
          : result.error
    });
  }

  return (
    <Card className="surface-elevated w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle className="text-3xl">Crear nueva contraseña</CardTitle>
        <CardDescription>
          Usa una contraseña segura con mayúsculas, minúsculas y números.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Actualizar contraseña
            </Button>
          </form>
        </Form>
        <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />
      </CardContent>
    </Card>
  );
}
