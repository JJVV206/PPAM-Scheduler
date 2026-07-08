import { requireRole } from "@/lib/auth/guards";
import { revalidateVolunteerViews } from "@/lib/cache/revalidate-volunteer-views";
import { accountNameSchema } from "@/lib/validations/user";
import { handleRouteError, ok } from "@/lib/utils/api";
import { updateUserAccountName } from "@/services/user.service";

type UserNameRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: UserNameRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = accountNameSchema.parse(await request.json());
    const account = await updateUserAccountName({
      userId: id,
      actorUserId: auth.session.user.id,
      name: body.name
    });

    revalidateVolunteerViews(account.volunteerProfile?.id);

    return ok(account);
  } catch (error) {
    return handleRouteError(error);
  }
}
