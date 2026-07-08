import { requireRole } from "@/lib/auth/guards";
import { revalidateVolunteerViews } from "@/lib/cache/revalidate-volunteer-views";
import { updateUserAccessSchema } from "@/lib/validations/user";
import { handleRouteError, ok } from "@/lib/utils/api";
import {
  reactivateUserAccount,
  suspendUserAccount
} from "@/services/user.service";

type UserAccessRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: UserAccessRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = updateUserAccessSchema.parse(await request.json());
    const account =
      body.action === "SUSPEND"
        ? await suspendUserAccount({
            userId: id,
            actorUserId: auth.session.user.id,
            note: body.note
          })
        : await reactivateUserAccount({
            userId: id,
            actorUserId: auth.session.user.id,
            note: body.note,
            canServeAsPrimary: body.canServeAsPrimary,
            canServeAsReplacement: body.canServeAsReplacement
          });

    revalidateVolunteerViews(account.volunteerProfile?.id);

    return ok(account);
  } catch (error) {
    return handleRouteError(error);
  }
}
