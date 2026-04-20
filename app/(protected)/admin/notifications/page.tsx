import { DataTable } from "@/components/forms/data-table";
import { NotificationTable } from "@/components/notifications/notification-table";
import { getNotificationHistory } from "@/services/notification-query.service";

export default async function AdminNotificationsPage() {
  const notifications = await getNotificationHistory();

  return (
    <DataTable
      title="Notifications"
      description="Track sent reminders, confirmation requests, and failed deliveries."
    >
      <NotificationTable notifications={notifications} />
    </DataTable>
  );
}
