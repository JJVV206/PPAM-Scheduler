import { requireRole } from "@/lib/auth/guards";
import { handleRouteError, ok } from "@/lib/utils/api";
import { getAssignmentInvitationResponseUrlForAdmin } from "@/services/assignment-invitation.service";

type AssignmentInvitationResponseUrlRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _: Request,
  { params }: AssignmentInvitationResponseUrlRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const data = await getAssignmentInvitationResponseUrlForAdmin(id);

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
