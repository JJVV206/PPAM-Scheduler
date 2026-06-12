import { requireRole } from "@/lib/auth/guards";
import { revalidateAssignmentViews } from "@/lib/cache/revalidate-assignment-views";
import { declineAssignmentSchema } from "@/lib/validations/assignment";
import { declineAssignment } from "@/services/assignment.service";
import { AppError } from "@/services/errors";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentDeclineRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentDeclineRouteContext
) {
  try {
    const auth = await requireRole(["VOLUNTEER"]);
    if ("error" in auth) return auth.error;
    if (!auth.session.user.volunteerProfileId) {
      throw new AppError("Falta el perfil del voluntario.", 400);
    }
    const { id } = await params;
    const body = declineAssignmentSchema.parse(await request.json());
    const result = await declineAssignment({
      assignmentId: id,
      volunteerProfileId: auth.session.user.volunteerProfileId,
      note: body.note
    });
    revalidateAssignmentViews({
      assignmentId: result.id,
      date: result.date,
      timeSlot: result.timeSlot
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
