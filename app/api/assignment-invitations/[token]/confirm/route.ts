import { revalidateAssignmentViews } from "@/lib/cache/revalidate-assignment-views";
import { confirmAssignmentSchema } from "@/lib/validations/assignment";
import { respondToAssignmentInvitation } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentInvitationConfirmRouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentInvitationConfirmRouteContext
) {
  try {
    const { token } = await params;
    const body = confirmAssignmentSchema.parse(await request.json());
    const result = await respondToAssignmentInvitation({
      token,
      responseStatus: "CONFIRMED",
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
