import { requireRole } from "@/lib/auth/guards";
import { parsePpamDateOnly } from "@/lib/assignments/time";
import { TIME_SLOTS } from "@/lib/constants/domain";
import { eligibleVolunteersQuerySchema } from "@/lib/validations/volunteer-eligibility";
import { handleRouteError, ok } from "@/lib/utils/api";
import { AppError } from "@/services/errors";
import {
  getEligiblePrimaryVolunteers,
  getVolunteerEligibilityContext
} from "@/services/volunteer-eligibility.service";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const searchParams = new URL(request.url).searchParams;
    const rawDate = searchParams.get("date");
    const rawTimeSlot = searchParams.get("timeSlot");

    if (
      !rawDate ||
      !rawTimeSlot ||
      !TIME_SLOTS.includes(rawTimeSlot as (typeof TIME_SLOTS)[number])
    ) {
      throw new AppError(
        "La fecha y el horario son obligatorios y válidos.",
        400
      );
    }

    const queryResult = eligibleVolunteersQuerySchema.safeParse({
      date: rawDate,
      timeSlot: rawTimeSlot,
      assignmentId: searchParams.get("assignmentId") ?? undefined
    });
    if (!queryResult.success) {
      throw new AppError("La fecha y el horario no son válidos.", 400);
    }
    const query = queryResult.data;
    const date = parsePpamDateOnly(query.date);

    if (!date) {
      throw new AppError("La fecha seleccionada no es válida.", 400);
    }

    const volunteers = await getEligiblePrimaryVolunteers({
      date,
      timeSlot: query.timeSlot,
      assignmentId: query.assignmentId
    });

    return ok({
      volunteers,
      context: getVolunteerEligibilityContext({
        date,
        timeSlot: query.timeSlot
      })
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
