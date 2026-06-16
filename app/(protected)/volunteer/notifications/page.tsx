import { DataTable } from "@/components/forms/data-table";
import { AppNotificationList } from "@/components/notifications/app-notification-list";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getAppNotificationsForUser } from "@/services/app-notification.service";

export default async function VolunteerNotificationsPage() {
  const session = await getServerAuthSession();

  if (!session?.user.id) {
    return null;
  }

  const notifications = await getAppNotificationsForUser({
    userId: session.user.id
  });

  return (
    <DataTable
      title="Mis notificaciones"
      description="Solicitudes de confirmación, recordatorios y avisos visibles dentro de la app."
    >
      <AppNotificationList notifications={notifications} role={session.user.role} />
    </DataTable>
  );
}
