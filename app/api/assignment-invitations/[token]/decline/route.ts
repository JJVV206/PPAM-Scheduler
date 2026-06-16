import { revalidateAssignmentViews } from "@/lib/cache/revalidate-assignment-views";
import { declineAssignmentSchema } from "@/lib/validations/assignment";
import { respondToAssignmentInvitation } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentInvitationDeclineRouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentInvitationDeclineRouteContext
) {
  try {
    const { token } = await params;
    const body = declineAssignmentSchema.parse(await request.json());
    const result = await respondToAssignmentInvitation({
      token,
      responseStatus: "DECLINED",
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
