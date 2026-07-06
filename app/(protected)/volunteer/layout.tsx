import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteerUiConfig } from "@/lib/volunteer-ui-config";
import { getUnreadAppNotificationCount } from "@/services/app-notification.service";
import { getVolunteer } from "@/services/volunteer.service";

export const dynamic = "force-dynamic";

export default async function VolunteerLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/logout?next=/login");
  }

  if (session.user.role !== "VOLUNTEER") {
    redirect("/admin");
  }

  const [unreadNotificationCount, volunteer] = await Promise.all([
    getUnreadAppNotificationCount(session.user.id),
    session.user.volunteerProfileId
      ? getVolunteer(session.user.volunteerProfileId)
      : null
  ]);
  const volunteerNavigationItems = volunteer
    ? getVolunteerUiConfig(volunteer).navigationItems
    : undefined;

  return (
    <PageShell
      role="VOLUNTEER"
      unreadNotificationCount={unreadNotificationCount}
      volunteerNavigationItems={volunteerNavigationItems}
    >
      {children}
    </PageShell>
  );
}
