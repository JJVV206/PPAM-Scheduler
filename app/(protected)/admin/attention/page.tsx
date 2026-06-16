import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";

import { DataTable } from "@/components/forms/data-table";
import { EmptyState } from "@/components/forms/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { getServerAuthSession } from "@/lib/auth/auth";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import { getAdminDashboardStats } from "@/services/dashboard.service";
import { getUnreadAdminAttentionNotificationsForUser } from "@/services/app-notification.service";
import type { AssignmentDetailDto } from "@/types/domain";

type AttentionPriority = "URGENT" | "HIGH" | "NORMAL";

type AttentionCase = {
  id: string;
  priority: AttentionPriority;
  date: Date;
  timeLabel: string;
  pointName: string;
  problem: string;
  href: string;
  actionLabel: string;
};

type AttentionNotification = Awaited<
  ReturnType<typeof getUnreadAdminAttentionNotificationsForUser>
>[number];

const priorityLabels: Record<AttentionPriority, string> = {
  URGENT: "Urgente",
  HIGH: "Alta",
  NORMAL: "Normal"
};

const priorityRank: Record<AttentionPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2
};

function getPriorityVariant(priority: AttentionPriority) {
  if (priority === "URGENT") return "danger" as const;
  if (priority === "HIGH") return "warning" as const;
  return "secondary" as const;
}

function notificationToAttentionCase(
  notification: AttentionNotification
): AttentionCase {
  if (notification.assignment) {
    return {
      id: `notification:${notification.id}`,
      priority:
        notification.priority === "URGENT" || notification.priority === "HIGH"
          ? notification.priority
          : "NORMAL",
      date: notification.assignment.date,
      timeLabel: TIME_SLOT_DEFINITIONS[notification.assignment.timeSlot].label,
      pointName: notification.assignment.preachingPoint.name,
      problem: `${notification.title}: ${notification.body}`,
      href: `/admin/assignments/${notification.assignment.id}`,
      actionLabel: "Abrir detalle"
    };
  }

  if (notification.census) {
    return {
      id: `notification:${notification.id}`,
      priority:
        notification.priority === "URGENT" || notification.priority === "HIGH"
          ? notification.priority
          : "NORMAL",
      date: notification.census.closesAt,
      timeLabel: "Censo semanal",
      pointName: "Suplentes",
      problem: `${notification.title}: ${notification.body}`,
      href: "/admin/replacements",
      actionLabel: "Ver suplentes"
    };
  }

  return {
    id: `notification:${notification.id}`,
    priority:
      notification.priority === "URGENT" || notification.priority === "HIGH"
        ? notification.priority
        : "NORMAL",
    date: notification.createdAt,
    timeLabel: "Operación",
    pointName: "PPAM",
    problem: `${notification.title}: ${notification.body}`,
    href: "/admin/settings",
    actionLabel: "Revisar"
  };
}

function assignmentToAttentionCase(assignment: AssignmentDetailDto): AttentionCase {
  const daysUntilAssignment = differenceInCalendarDays(
    assignment.date,
    new Date()
  );
  const priority = daysUntilAssignment <= 2 ? "URGENT" : "HIGH";
  const problem = assignment.warnings.length
    ? assignment.warnings.join(" · ")
    : assignment.automationState.description;

  return {
    id: `assignment:${assignment.id}`,
    priority,
    date: assignment.date,
    timeLabel: TIME_SLOT_DEFINITIONS[assignment.timeSlot].label,
    pointName: assignment.preachingPoint.name,
    problem,
    href: `/admin/assignments/${assignment.id}`,
    actionLabel: "Abrir detalle"
  };
}

function sortAttentionCases(cases: AttentionCase[]) {
  return [...cases].sort((left, right) => {
    const priorityDifference =
      priorityRank[left.priority] - priorityRank[right.priority];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return left.date.getTime() - right.date.getTime();
  });
}

export default async function AdminAttentionPage() {
  const session = await getServerAuthSession();

  if (!session?.user.id) {
    return null;
  }

  const [dashboard, notifications] = await Promise.all([
    getAdminDashboardStats(),
    getUnreadAdminAttentionNotificationsForUser({
      userId: session.user.id
    })
  ]);
  const notificationAssignmentIds = new Set(
    notifications
      .map((notification) => notification.assignmentId)
      .filter((assignmentId): assignmentId is string => Boolean(assignmentId))
  );
  const cases = sortAttentionCases([
    ...notifications.map(notificationToAttentionCase),
    ...dashboard.requiresAttention
      .filter((assignment) => !notificationAssignmentIds.has(assignment.id))
      .map(assignmentToAttentionCase)
  ]);

  return (
    <DataTable
      title="Atención requerida"
      description="Excepciones activas donde el sistema ya necesita decisión manual."
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/schedule">Ir al horario semanal</Link>
        </Button>
      }
    >
      {cases.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridad</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Punto</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant={getPriorityVariant(item.priority)}>
                      {priorityLabels[item.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDisplayDate(item.date, "d 'de' MMMM")}
                  </TableCell>
                  <TableCell>{item.timeLabel}</TableCell>
                  <TableCell>{item.pointName}</TableCell>
                  <TableCell className="max-w-xl text-sm text-muted-foreground">
                    {item.problem}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm">
                      <Link href={item.href}>{item.actionLabel}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="Sin excepciones activas"
          description="El flujo automático no requiere intervención manual ahora."
        />
      )}
    </DataTable>
  );
}
