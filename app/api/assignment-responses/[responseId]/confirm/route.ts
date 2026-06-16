import { requireRole } from "@/lib/auth/guards";
import { revalidateAssignmentViews } from "@/lib/cache/revalidate-assignment-views";
import { confirmAssignmentSchema } from "@/lib/validations/assignment";
import { confirmAssignmentResponseById } from "@/services/assignment.service";
import { AppError } from "@/services/errors";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentResponseConfirmRouteContext = {
  params: Promise<{ responseId: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentResponseConfirmRouteContext
) {
  try {
    const auth = await requireRole(["VOLUNTEER"]);
    if ("error" in auth) return auth.error;
    if (!auth.session.user.volunteerProfileId) {
      throw new AppError("Falta el perfil del voluntario.", 400);
    }

    const { responseId } = await params;
    const body = confirmAssignmentSchema.parse(await request.json());
    const result = await confirmAssignmentResponseById({
      responseId,
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
