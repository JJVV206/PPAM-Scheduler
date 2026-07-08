import { getUnreadAdminAttentionNotificationReferencesForUser } from "@/services/app-notification.service";
import { getAdminDashboardStats } from "@/services/dashboard.service";

export async function getAdminAttentionCaseCountForUser(input: {
  userId: string;
}) {
  const [dashboard, notifications] = await Promise.all([
    getAdminDashboardStats(),
    getUnreadAdminAttentionNotificationReferencesForUser({
      userId: input.userId
    })
  ]);
  const notificationAssignmentIds = new Set(
    notifications
      .map((notification) => notification.assignmentId)
      .filter((assignmentId): assignmentId is string => Boolean(assignmentId))
  );
  const calculatedCases = dashboard.requiresAttention.filter(
    (assignment) => !notificationAssignmentIds.has(assignment.id)
  );

  return notifications.length + calculatedCases.length;
}
