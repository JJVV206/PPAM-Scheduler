import { DataTable } from "@/components/forms/data-table";
import { NotificationTable } from "@/components/notifications/notification-table";
import { getNotificationHistory } from "@/services/notification-query.service";

export default async function AdminNotificationsPage() {
  const notifications = await getNotificationHistory();

  return (
    <DataTable
      title="Notificaciones"
      description="Da seguimiento a recordatorios enviados, solicitudes de confirmación y entregas fallidas. En local, el registro en NotificationLog sirve como trazabilidad mínima."
    >
      <NotificationTable notifications={notifications} />
    </DataTable>
  );
}
