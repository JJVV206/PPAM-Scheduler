import { requireRole } from "@/lib/auth/guards";
import { revalidateVolunteerViews } from "@/lib/cache/revalidate-volunteer-views";
import { anonymizeUserAccountSchema } from "@/lib/validations/user";
import { handleRouteError, ok } from "@/lib/utils/api";
import { anonymizeUserAccount } from "@/services/user.service";

type UserAnonymizeRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: UserAnonymizeRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = anonymizeUserAccountSchema.parse(await request.json());
    const account = await anonymizeUserAccount({
      userId: id,
      actorUserId: auth.session.user.id,
      confirmationEmail: body.confirmationEmail
    });

    revalidateVolunteerViews(account.volunteerProfile?.id);

    return ok(account);
  } catch (error) {
    return handleRouteError(error);
  }
}
