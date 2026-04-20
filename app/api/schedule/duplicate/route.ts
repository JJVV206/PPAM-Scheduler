import { z } from "zod";

import { requireRole } from "@/lib/auth/guards";
import { duplicateScheduleWeek } from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

const duplicateWeekSchema = z.object({
  sourceWeekId: z.string().min(1),
  targetWeekStart: z.string().datetime()
});

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const body = duplicateWeekSchema.parse(await request.json());
    const result = await duplicateScheduleWeek({
      sourceWeekId: body.sourceWeekId,
      targetWeekStart: new Date(body.targetWeekStart),
      actorUserId: auth.session.user.id
    });
    return ok(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
