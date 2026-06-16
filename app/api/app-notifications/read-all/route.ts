import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guards";
import { handleRouteError, ok } from "@/lib/utils/api";
import { markAllAppNotificationsRead } from "@/services/app-notification.service";

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const result = await markAllAppNotificationsRead({
      userId: auth.session.user.id
    });

    revalidatePath(
      auth.session.user.role === "ADMIN"
        ? "/admin/notifications"
        : "/volunteer/notifications"
    );

    return ok({
      updatedCount: result.count
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
