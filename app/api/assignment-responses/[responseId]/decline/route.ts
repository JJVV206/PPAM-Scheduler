import { declineAssignmentSchema } from "@/lib/validations/assignment";
import { declineAssignmentResponseById } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentResponseDeclineRouteContext = {
  params: Promise<{ responseId: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentResponseDeclineRouteContext
) {
  try {
    const { responseId } = await params;
    const body = declineAssignmentSchema.parse(await request.json());
    const result = await declineAssignmentResponseById({
      responseId,
      note: body.note
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
