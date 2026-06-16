import { requireRole } from "@/lib/auth/guards";
import { sendAssignmentConfirmationRequests } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentNotificationRequestRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _: Request,
  { params }: AssignmentNotificationRequestRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const result = await sendAssignmentConfirmationRequests({
      assignmentId: id,
      actorUserId: auth.session.user.id
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
