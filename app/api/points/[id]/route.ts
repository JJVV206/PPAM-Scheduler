import { requireRole } from "@/lib/auth/guards";
import { updatePreachingPointSchema } from "@/lib/validations/point";
import { deletePreachingPoint, getPreachingPoint, updatePreachingPoint } from "@/services/point.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type PointRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: PointRouteContext) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const point = await getPreachingPoint(id);
    return ok(point);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: PointRouteContext) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = updatePreachingPointSchema.parse(await request.json());
    const point = await updatePreachingPoint(id, body);
    return ok(point);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: PointRouteContext) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    await deletePreachingPoint(id);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
