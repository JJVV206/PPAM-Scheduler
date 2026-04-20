import { requireSession } from "@/lib/auth/guards";
import { replacementAssignmentSchema } from "@/lib/validations/assignment";
import { assignReplacementVolunteer } from "@/services/assignment.service";
import { AppError } from "@/services/errors";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentReplaceRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentReplaceRouteContext
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = replacementAssignmentSchema.parse(await request.json());

    const volunteerId =
      auth.session.user.role === "ADMIN"
        ? body.volunteerId
        : auth.session.user.volunteerProfileId;

    if (!volunteerId) {
      throw new AppError("Volunteer selection is required.", 400);
    }

    const result = await assignReplacementVolunteer({
      assignmentId: id,
      volunteerId,
      position: body.position,
      actorUserId: auth.session.user.id
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
