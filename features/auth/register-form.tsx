"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { registerSchema } from "@/lib/validations/auth";

type RegisterValues = z.infer<typeof registerSchema>;

type RegisterFormProps = {
  authReady?: boolean;
  environmentMessage?: string;
};

export function RegisterForm({
  authReady = true,
  environmentMessage
}: RegisterFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: ""
    }
  });

  async function onSubmit(values: RegisterValues) {
    if (!authReady) {
      setError(
        environmentMessage ?? "La configuración del servidor está incompleta."
      );
      return;
    }

    setError(null);
    setSuccessMessage(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(values)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error ?? "No fue posible crear la cuenta.");
      return;
    }

    form.reset();
    setSuccessMessage(
      result.message ??
        "Tu solicitud fue recibida. Un administrador debe aprobar tu cuenta antes de que puedas iniciar sesión."
    );
  }

  return (
    <Card className="surface-elevated w-full max-w-[32rem]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-3xl">Crear cuenta</CardTitle>
        <CardDescription>
          Registra tu acceso para consultar asignaciones, confirmar turnos y
          responder disponibilidad.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {environmentMessage ? (
          <div className="mb-5 rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning">
            {environmentMessage}
          </div>
        ) : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre completo" {...field} />
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
                    <Input
                      type="email"
                      placeholder="tu-correo@ejemplo.com"
                      {...field}
                    />
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
                  <FormLabel>Celular</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+52 777 123 4567"
                      autoComplete="tel"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Crea una contraseña"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Usa al menos 8 caracteres con mayúscula, minúscula y número.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Repite tu contraseña"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {successMessage ? (
              <div className="rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                {successMessage}
              </div>
            ) : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button
              className="w-full"
              type="submit"
              disabled={!authReady || form.formState.isSubmitting}
            >
              Enviar solicitud
            </Button>
          </form>
        </Form>
        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>¿Ya tienes cuenta?</span>
          <Link href="/login" className="text-primary">
            Iniciar sesión
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
