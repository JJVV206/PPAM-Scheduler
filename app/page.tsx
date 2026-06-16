import { redirect } from "next/navigation";

import { getAuthRuntimeStatus } from "@/lib/env/runtime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const status = await getAuthRuntimeStatus();

  if (!status.ready) {
    redirect("/login");
  }

  const { getServerAuthSession } = await import("@/lib/auth/auth");
  const session = await getServerAuthSession().catch(() => null);

  if (!session) {
    redirect("/login");
  }

  redirect(session.user.role === "ADMIN" ? "/admin" : "/volunteer");
}
