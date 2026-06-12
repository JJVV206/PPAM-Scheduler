import { requireRole } from "@/lib/auth/guards";
import { revalidateAssignmentViews } from "@/lib/cache/revalidate-assignment-views";
import { createAssignmentSchema, assignmentFiltersSchema } from "@/lib/validations/assignment";
import { createWeeklyAssignment, getAssignments } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const filters = assignmentFiltersSchema.parse({
      volunteerId: searchParams.get("volunteerId") ?? undefined,
      pointId: searchParams.get("pointId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined
    });

    const data = await getAssignments(filters);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const body = createAssignmentSchema.parse(await request.json());
    const assignment = await createWeeklyAssignment({
      scheduleWeekId: body.scheduleWeekId,
      date: new Date(body.date),
      dayOfWeek: body.dayOfWeek,
      timeSlot: body.timeSlot,
      preachingPointId: body.preachingPointId,
      notes: body.notes,
      volunteers: body.volunteers,
      actorUserId: auth.session.user.id
    });

    revalidateAssignmentViews({
      assignmentId: assignment.id,
      date: assignment.date,
      timeSlot: assignment.timeSlot
    });

    return ok(assignment, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
