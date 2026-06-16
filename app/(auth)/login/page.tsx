import { redirect } from "next/navigation";

import { getAuthRuntimeStatus } from "@/lib/env/runtime";
import { LoginForm } from "@/features/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const status = await getAuthRuntimeStatus();

  if (!status.ready) {
    return (
      <LoginForm
        authReady={status.ready}
        environmentMessage={status.message}
      />
    );
  }

  const { getServerAuthSession } = await import("@/lib/auth/auth");
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/volunteer");
  }

  return (
    <LoginForm
      authReady={status.ready}
      environmentMessage={status.message}
    />
  );
}
