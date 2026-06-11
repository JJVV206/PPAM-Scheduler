import { requireSession, requireRole } from "@/lib/auth/guards";
import { updateAssignmentSchema } from "@/lib/validations/assignment";
import { deleteAssignment, getAssignmentDetail, updateAssignment } from "@/services/assignment.service";
import { AppError } from "@/services/errors";
import { handleRouteError, ok } from "@/lib/utils/api";

type AssignmentRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: AssignmentRouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const assignment = await getAssignmentDetail(id);

    if (
      auth.session.user.role === "VOLUNTEER" &&
      !assignment.volunteers.some(
        (volunteer) => volunteer.volunteerId === auth.session.user.volunteerProfileId
      )
    ) {
      throw new AppError("Acceso denegado", 403);
    }

    return ok(assignment);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: AssignmentRouteContext) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = updateAssignmentSchema.parse(await request.json());

    const assignment = await updateAssignment(id, {
      date: body.date ? new Date(body.date) : undefined,
      dayOfWeek: body.dayOfWeek,
      timeSlot: body.timeSlot,
      preachingPointId: body.preachingPointId,
      status: body.status,
      notes: body.notes,
      volunteers: body.volunteers,
      actorUserId: auth.session.user.id
    });

    return ok(assignment);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: AssignmentRouteContext) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    await deleteAssignment(id);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
