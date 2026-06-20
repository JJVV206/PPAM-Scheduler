"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/validations/auth";

type LoginValues = z.infer<typeof loginSchema>;

type LoginFormProps = {
  authReady?: boolean;
  environmentMessage?: string;
};

export function LoginForm({
  authReady = true,
  environmentMessage
}: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  async function onSubmit(values: LoginValues) {
    if (!authReady) {
      setError(environmentMessage ?? "La configuración del servidor está incompleta.");
      return;
    }

    setError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl: "/"
    });

    if (result?.error) {
      setError(
        result.error === "CredentialsSignin"
          ? "Credenciales inválidas o cuenta pendiente de aprobación."
          : "No fue posible iniciar sesión. Revisa la configuración del servidor y la conexión a la base de datos."
      );
      return;
    }

    router.push(result?.url ?? "/");
    router.refresh();
  }

  return (
    <Card className="surface-elevated w-full max-w-[30rem]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-3xl">Bienvenido de nuevo</CardTitle>
        <CardDescription>
          Inicia sesión para gestionar horarios, confirmaciones y reemplazos.
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@ppam.local" {...field} />
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
                    <Input type="password" placeholder="Ingresa tu contraseña" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={!authReady}>
              Entrar
            </Button>
          </form>
        </Form>
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>¿Necesitas restablecer el acceso?</span>
          <Link href="/forgot-password" className="text-primary">
            Olvidé mi contraseña
          </Link>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>¿No tienes cuenta?</span>
          <Link href="/register" className="text-primary">
            Crear cuenta
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
