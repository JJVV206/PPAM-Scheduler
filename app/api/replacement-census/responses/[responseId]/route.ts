import { requireRole } from "@/lib/auth/guards";
import { replacementCensusSubmissionSchema } from "@/lib/validations/replacement-census";
import { submitReplacementCensusResponseManually } from "@/services/replacement-census.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type ReplacementCensusResponseRouteContext = {
  params: Promise<{ responseId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: ReplacementCensusResponseRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { responseId } = await params;
    const body = replacementCensusSubmissionSchema.parse(await request.json());
    const result = await submitReplacementCensusResponseManually({
      responseId,
      actorUserId: auth.session.user.id,
      days: body.days.map((day) => ({
        date: new Date(day.date),
        dayOfWeek: day.dayOfWeek,
        available: day.available,
        timeSlots: day.timeSlots,
        notes: day.notes
      }))
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
