import { requireSession } from "@/lib/auth/guards";
import { accountNameSchema } from "@/lib/validations/user";
import { handleRouteError, ok } from "@/lib/utils/api";
import { updateOwnAccountName } from "@/services/user.service";

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = accountNameSchema.parse(await request.json());
    const account = await updateOwnAccountName({
      userId: auth.session.user.id,
      name: body.name
    });

    return ok(account);
  } catch (error) {
    return handleRouteError(error);
  }
}
