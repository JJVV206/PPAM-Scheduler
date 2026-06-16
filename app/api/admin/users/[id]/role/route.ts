import { requireRole } from "@/lib/auth/guards";
import { revalidateVolunteerViews } from "@/lib/cache/revalidate-volunteer-views";
import { updateUserRoleSchema } from "@/lib/validations/user";
import { handleRouteError, ok } from "@/lib/utils/api";
import { updateUserRole } from "@/services/user.service";

type UserRoleRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: UserRoleRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = updateUserRoleSchema.parse(await request.json());
    const account = await updateUserRole({
      userId: id,
      role: body.role
    });

    revalidateVolunteerViews(account.volunteerProfile?.id);

    return ok(account);
  } catch (error) {
    return handleRouteError(error);
  }
}
