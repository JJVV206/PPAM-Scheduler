import { redirect } from "next/navigation";

import { getAuthRuntimeStatus } from "@/lib/env/runtime";
import { RegisterForm } from "@/features/auth/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const status = await getAuthRuntimeStatus();

  if (!status.ready) {
    return (
      <RegisterForm
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
    <RegisterForm
      authReady={status.ready}
      environmentMessage={status.message}
    />
  );
}
