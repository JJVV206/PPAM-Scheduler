import { requireRole } from "@/lib/auth/guards";
import { createPreachingPointSchema } from "@/lib/validations/point";
import { createPreachingPoint, getPreachingPoints } from "@/services/point.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function GET() {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const points = await getPreachingPoints();
    return ok(points);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const body = createPreachingPointSchema.parse(await request.json());
    const point = await createPreachingPoint(body);
    return ok(point, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
