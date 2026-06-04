import { requireRole } from "@/lib/auth/guards";
import { resendAssignmentConfirmation } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentNotificationReminderRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _: Request,
  { params }: AssignmentNotificationReminderRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const result = await resendAssignmentConfirmation(id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
