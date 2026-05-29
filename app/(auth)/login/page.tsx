import { getAuthRuntimeStatus } from "@/lib/env/runtime";
import { LoginForm } from "@/features/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const status = await getAuthRuntimeStatus();

  return (
    <LoginForm
      authReady={status.ready}
      environmentMessage={status.message}
    />
  );
}
