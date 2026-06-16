import { replacementCensusSubmissionSchema } from "@/lib/validations/replacement-census";
import { submitReplacementCensusResponse } from "@/services/replacement-census.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type ReplacementCensusTokenRouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(
  request: Request,
  { params }: ReplacementCensusTokenRouteContext
) {
  try {
    const { token } = await params;
    const body = replacementCensusSubmissionSchema.parse(await request.json());
    const result = await submitReplacementCensusResponse({
      token,
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
