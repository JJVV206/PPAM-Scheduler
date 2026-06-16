import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getUnreadAppNotificationCount } from "@/services/app-notification.service";

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

  const unreadNotificationCount = await getUnreadAppNotificationCount(
    session.user.id
  );

  return (
    <PageShell
      role="ADMIN"
      unreadNotificationCount={unreadNotificationCount}
    >
      {children}
    </PageShell>
  );
}
