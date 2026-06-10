import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_TYPE_LABELS
} from "@/lib/constants/domain";
import { humanizeErrorMessage } from "@/lib/utils/error-message";
import { formatDisplayDate } from "@/lib/utils";

type NotificationTableProps = {
  notifications: Array<{
    id: string;
    type: string;
    channel: string;
    status: string;
    createdAt: Date;
    sentAt?: Date | null;
    errorMessage?: string | null;
    user: { name: string };
    assignment?: { preachingPoint: { name: string } } | null;
  }>;
};

export function NotificationTable({ notifications }: NotificationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Destinatario</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Asignación</TableHead>
          <TableHead>Detalle</TableHead>
          <TableHead>Creada</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notifications.map((notification) => (
          <TableRow key={notification.id}>
            <TableCell>{notification.user.name}</TableCell>
            <TableCell>
              {NOTIFICATION_TYPE_LABELS[
                notification.type as keyof typeof NOTIFICATION_TYPE_LABELS
              ] ?? notification.type}
            </TableCell>
            <TableCell>
              {NOTIFICATION_CHANNEL_LABELS[
                notification.channel as keyof typeof NOTIFICATION_CHANNEL_LABELS
              ] ?? notification.channel}
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  notification.status === "SENT"
                    ? "success"
                    : notification.status === "FAILED"
                      ? "danger"
                      : "warning"
                }
              >
                {NOTIFICATION_STATUS_LABELS[
                  notification.status as keyof typeof NOTIFICATION_STATUS_LABELS
                ] ?? notification.status}
              </Badge>
            </TableCell>
            <TableCell>
              {notification.assignment?.preachingPoint.name ?? "General"}
            </TableCell>
            <TableCell
              className={
                notification.errorMessage
                  ? "text-sm text-danger"
                  : "text-sm text-muted-foreground"
              }
            >
              {notification.errorMessage
                ? humanizeErrorMessage(notification.errorMessage)
                : notification.sentAt
                  ? `Enviada ${formatDisplayDate(notification.sentAt, "d 'de' MMM, h:mm a")}`
                  : "Registrada en entorno local"}
            </TableCell>
            <TableCell>
              {formatDisplayDate(notification.createdAt, "d 'de' MMM, h:mm a")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
