import { requireRole } from "@/lib/auth/guards";
import { assignmentPreflightSchema } from "@/lib/validations/assignment";
import { getSameDayVolunteerRepeatWarnings } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const body = assignmentPreflightSchema.parse(await request.json());
    const data = await getSameDayVolunteerRepeatWarnings({
      assignmentId: body.assignmentId,
      date: new Date(body.date),
      timeSlot: body.timeSlot,
      volunteerIds: body.volunteerIds
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
