import { requireRole } from "@/lib/auth/guards";
import { revalidateVolunteerViews } from "@/lib/cache/revalidate-volunteer-views";
import { updateVolunteerSchema } from "@/lib/validations/volunteer";
import {
  deactivateVolunteer,
  getVolunteer,
  updateVolunteer
} from "@/services/volunteer.service";
import { handleRouteError, ok } from "@/lib/utils/api";

type VolunteerRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: VolunteerRouteContext) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const volunteer = await getVolunteer(id);
    return ok(volunteer);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: VolunteerRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = updateVolunteerSchema.parse(await request.json());
    const result = await updateVolunteer(id, body);
    revalidateVolunteerViews(id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: VolunteerRouteContext) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const result = await deactivateVolunteer(id, {
      actorUserId: auth.session.user.id
    });
    revalidateVolunteerViews(id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
