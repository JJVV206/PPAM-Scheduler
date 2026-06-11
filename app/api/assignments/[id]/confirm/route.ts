import { requireRole } from "@/lib/auth/guards";
import { confirmAssignmentSchema } from "@/lib/validations/assignment";
import { confirmAssignment } from "@/services/assignment.service";
import { AppError } from "@/services/errors";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentConfirmRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentConfirmRouteContext
) {
  try {
    const auth = await requireRole(["VOLUNTEER"]);
    if ("error" in auth) return auth.error;
    if (!auth.session.user.volunteerProfileId) {
      throw new AppError("Falta el perfil del voluntario.", 400);
    }
    const { id } = await params;
    const body = confirmAssignmentSchema.parse(await request.json());
    const result = await confirmAssignment({
      assignmentId: id,
      volunteerProfileId: auth.session.user.volunteerProfileId,
      note: body.note
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
