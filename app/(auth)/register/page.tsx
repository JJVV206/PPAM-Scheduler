import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth/auth";
import { getAuthRuntimeStatus } from "@/lib/env/runtime";
import { RegisterForm } from "@/features/auth/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/volunteer");
  }

  const status = await getAuthRuntimeStatus();

  return (
    <RegisterForm
      authReady={status.ready}
      environmentMessage={status.message}
    />
  );
}
