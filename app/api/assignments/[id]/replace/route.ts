import { requireRole } from "@/lib/auth/guards";
import { revalidateAssignmentViews } from "@/lib/cache/revalidate-assignment-views";
import { replacementAssignmentSchema } from "@/lib/validations/assignment";
import { assignReplacementVolunteer } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentReplaceRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentReplaceRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = replacementAssignmentSchema.parse(await request.json());

    const result = await assignReplacementVolunteer({
      assignmentId: id,
      volunteerId: body.volunteerId,
      position: body.position,
      actorUserId: auth.session.user.id
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
