"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema } from "@/lib/validations/auth";

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFeedback(null);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    if (response.ok) {
      setFeedback({
        tone: "success",
        text: "Si el correo existe, ya enviamos un enlace para restablecer la contraseña."
      });
    } else {
      const result = await response.json();
      setFeedback({
        tone: "error",
        text:
          result.error ??
          "No fue posible enviar las instrucciones de restablecimiento."
      });
    }
  }

  return (
    <Card className="surface-elevated w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle className="text-3xl">Restablecer contraseña</CardTitle>
        <CardDescription>
          Ingresa tu correo y te enviaremos un enlace de restablecimiento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <Button type="submit" className="w-full">
              Enviar enlace
            </Button>
          </form>
        </Form>
        <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />
        <Link href="/login" className="block text-sm text-primary">
          Volver al acceso
        </Link>
      </CardContent>
    </Card>
  );
}
