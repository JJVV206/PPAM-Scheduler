import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDisplayDate } from "@/lib/utils";

type NotificationTableProps = {
  notifications: Array<{
    id: string;
    type: string;
    channel: string;
    status: string;
    createdAt: Date;
    user: { name: string };
    assignment?: { preachingPoint: { name: string } } | null;
  }>;
};

export function NotificationTable({ notifications }: NotificationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Recipient</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assignment</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notifications.map((notification) => (
          <TableRow key={notification.id}>
            <TableCell>{notification.user.name}</TableCell>
            <TableCell>{notification.type.replaceAll("_", " ")}</TableCell>
            <TableCell>{notification.channel}</TableCell>
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
                {notification.status}
              </Badge>
            </TableCell>
            <TableCell>
              {notification.assignment?.preachingPoint.name ?? "General"}
            </TableCell>
            <TableCell>{formatDisplayDate(notification.createdAt, "MMM d, h:mm a")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
