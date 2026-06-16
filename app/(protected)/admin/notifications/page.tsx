import { DataTable } from "@/components/forms/data-table";
import { AppNotificationList } from "@/components/notifications/app-notification-list";
import { NotificationTable } from "@/components/notifications/notification-table";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getAppNotificationsForUser } from "@/services/app-notification.service";
import { getNotificationHistory } from "@/services/notification-query.service";

export default async function AdminNotificationsPage() {
  const session = await getServerAuthSession();

  if (!session?.user.id) {
    return null;
  }

  const [appNotifications, notifications] = await Promise.all([
    getAppNotificationsForUser({
      userId: session.user.id
    }),
    getNotificationHistory()
  ]);

  return (
    <div className="space-y-6">
      <DataTable
        title="Notificaciones internas"
        description="Pendientes visibles dentro de la app y alertas que requieren seguimiento operativo."
      >
        <AppNotificationList
          notifications={appNotifications}
          role={session.user.role}
        />
      </DataTable>

      <DataTable
        title="Historial de emails"
        description="Auditoría de solicitudes, recordatorios y entregas fallidas registradas en NotificationLog."
      >
        <NotificationTable notifications={notifications} />
      </DataTable>
    </div>
  );
}
