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
      setError(environmentMessage ?? "Server configuration is incomplete.");
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
          ? "Invalid credentials."
          : "Unable to sign in. Check the server configuration and database connection."
      );
      return;
    }

    router.push(result?.url ?? "/");
    router.refresh();
  }

  return (
    <Card className="surface-elevated w-full max-w-[30rem]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-3xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to manage schedules, confirmations, and replacements.
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={!authReady}>
              Sign in
            </Button>
          </form>
        </Form>
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Need to reset access?</span>
          <Link href="/forgot-password" className="text-primary">
            Forgot password
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
