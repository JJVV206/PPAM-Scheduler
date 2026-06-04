import { confirmAssignmentSchema } from "@/lib/validations/assignment";
import { confirmAssignmentResponseById } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentResponseConfirmRouteContext = {
  params: Promise<{ responseId: string }>;
};

export async function POST(
  request: Request,
  { params }: AssignmentResponseConfirmRouteContext
) {
  try {
    const { responseId } = await params;
    const body = confirmAssignmentSchema.parse(await request.json());
    const result = await confirmAssignmentResponseById({
      responseId,
      note: body.note
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
