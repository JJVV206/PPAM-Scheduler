import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { getServerAuthSession } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/volunteer");
  }

  return (
    <PageShell role="ADMIN">
      {children}
    </PageShell>
  );
}
