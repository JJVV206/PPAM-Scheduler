import { requireRole } from "@/lib/auth/guards";
import { revalidateVolunteerViews } from "@/lib/cache/revalidate-volunteer-views";
import { reviewUserAdmissionSchema } from "@/lib/validations/user";
import { handleRouteError, ok } from "@/lib/utils/api";
import { reviewUserAdmission } from "@/services/user.service";

type UserAdmissionRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: UserAdmissionRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = reviewUserAdmissionSchema.parse(await request.json());
    const account = await reviewUserAdmission({
      userId: id,
      actorUserId: auth.session.user.id,
      decision: body.decision,
      note: body.note
    });

    revalidateVolunteerViews(account.volunteerProfile?.id);

    return ok(account);
  } catch (error) {
    return handleRouteError(error);
  }
}
