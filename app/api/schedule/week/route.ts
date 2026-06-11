import { z } from "zod";

import { requireRole } from "@/lib/auth/guards";
import { scheduleFiltersSchema } from "@/lib/validations/assignment";
import {
  createScheduleWeek,
  getWeeklySchedule
} from "@/services/assignment.service";
import { handleRouteError, ok } from "@/lib/utils/api";

const createWeekSchema = z.object({
  targetWeekStart: z.string().datetime()
});

export async function GET(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const filters = scheduleFiltersSchema.parse({
      weekStart: searchParams.get("weekStart") ?? undefined,
      day: searchParams.get("day") ?? undefined,
      pointId: searchParams.get("pointId") ?? undefined,
      status: searchParams.get("status") ?? undefined
    });

    const data = await getWeeklySchedule({
      weekStart: filters.weekStart ? new Date(filters.weekStart) : undefined,
      filters: {
        day: filters.day,
        pointId: filters.pointId,
        status: filters.status
      }
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const body = createWeekSchema.parse(await request.json());
    const data = await createScheduleWeek({
      targetWeekStart: new Date(body.targetWeekStart),
      actorUserId: auth.session.user.id
    });

    return ok(data, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
