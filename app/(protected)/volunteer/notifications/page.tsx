import { DataTable } from "@/components/forms/data-table";
import { NotificationTable } from "@/components/notifications/notification-table";
import { getServerAuthSession } from "@/lib/auth/auth";
import { db } from "@/lib/db/prisma";

export default async function VolunteerNotificationsPage() {
  const session = await getServerAuthSession();

  if (!session?.user.id) {
    return null;
  }

  const notifications = await db.notificationLog.findMany({
    where: { userId: session.user.id },
    include: {
      user: true,
      assignment: {
        include: { preachingPoint: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <DataTable
      title="My Notifications"
      description="Confirmation requests, reminders, and assignment changes."
    >
      <NotificationTable notifications={notifications} />
    </DataTable>
  );
}
