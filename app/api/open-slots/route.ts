import { requireSession } from "@/lib/auth/guards";
import { replacementAssignmentSchema } from "@/lib/validations/assignment";
import { assignReplacementVolunteer, getOpenSlots } from "@/services/assignment.service";
import { AppError } from "@/services/errors";
import { handleRouteError, ok } from "@/lib/utils/api";

const openSlotRequestSchema = replacementAssignmentSchema.extend({
  assignmentId: replacementAssignmentSchema.shape.volunteerId
});

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const openSlots = await getOpenSlots();
    return ok(openSlots);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = openSlotRequestSchema.parse(await request.json());
    const volunteerId =
      auth.session.user.role === "ADMIN"
        ? body.volunteerId
        : auth.session.user.volunteerProfileId;

    if (!volunteerId) {
      throw new AppError("Debes seleccionar un voluntario.", 400);
    }

    const result = await assignReplacementVolunteer({
      assignmentId: body.assignmentId,
      volunteerId,
      actorUserId: auth.session.user.id,
      position: body.position
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
