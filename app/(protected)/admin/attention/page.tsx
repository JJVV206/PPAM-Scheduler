import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";

import { DataTable } from "@/components/forms/data-table";
import { EmptyState } from "@/components/forms/empty-state";
import { Button } from "@/components/ui/button";
import {
  AdminAttentionTable,
  type AdminAttentionCase
} from "@/features/admin/admin-attention-table";
import { getServerAuthSession } from "@/lib/auth/auth";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { getAdminDashboardStats } from "@/services/dashboard.service";
import { getUnreadAdminAttentionNotificationsForUser } from "@/services/app-notification.service";
import type { AssignmentDetailDto } from "@/types/domain";

type AttentionNotification = Awaited<
  ReturnType<typeof getUnreadAdminAttentionNotificationsForUser>
>[number];

function notificationToAttentionCase(
  notification: AttentionNotification
): AdminAttentionCase {
  const baseCase = {
    id: `notification:${notification.id}`,
    createdAt: notification.createdAt,
    problem: `${notification.title}: ${notification.body}`,
    notificationId: notification.id,
    dismissible: true,
    priority:
      notification.priority === "URGENT" || notification.priority === "HIGH"
        ? notification.priority
        : "NORMAL"
  } satisfies Pick<
    AdminAttentionCase,
    | "id"
    | "createdAt"
    | "problem"
    | "notificationId"
    | "dismissible"
    | "priority"
  >;

  if (notification.assignment) {
    return {
      ...baseCase,
      date: notification.assignment.date,
      timeLabel: TIME_SLOT_DEFINITIONS[notification.assignment.timeSlot].label,
      pointName: notification.assignment.preachingPoint.name,
      href: `/admin/assignments/${notification.assignment.id}`,
      actionLabel: "Abrir detalle"
    };
  }

  if (notification.census) {
    return {
      ...baseCase,
      date: notification.census.closesAt,
      timeLabel: "Censo semanal",
      pointName: "Suplentes",
      href: "/admin/replacements",
      actionLabel: "Ver suplentes"
    };
  }

  return {
    ...baseCase,
    date: notification.createdAt,
    timeLabel: "Operación",
    pointName: "PPAM",
    href: "/admin/settings",
    actionLabel: "Revisar"
  };
}

function getLatestAssignmentActivityDate(assignment: AssignmentDetailDto) {
  return assignment.timeline.reduce(
    (latestDate, item) =>
      item.createdAt > latestDate ? item.createdAt : latestDate,
    assignment.date
  );
}

function assignmentToAttentionCase(
  assignment: AssignmentDetailDto
): AdminAttentionCase {
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
    createdAt: getLatestAssignmentActivityDate(assignment),
    date: assignment.date,
    timeLabel: TIME_SLOT_DEFINITIONS[assignment.timeSlot].label,
    pointName: assignment.preachingPoint.name,
    problem,
    href: `/admin/assignments/${assignment.id}`,
    actionLabel: "Abrir detalle",
    dismissible: false
  };
}

function sortAttentionCases(cases: AdminAttentionCase[]) {
  return [...cases].sort((left, right) => {
    return right.createdAt.getTime() - left.createdAt.getTime();
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
        <AdminAttentionTable cases={cases} />
      ) : (
        <EmptyState
          title="Sin excepciones activas"
          description="El flujo automático no requiere intervención manual ahora."
        />
      )}
    </DataTable>
  );
}
