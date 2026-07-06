import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { handleRouteError, ok } from "@/lib/utils/api";
import { dismissAdminAttentionNotification } from "@/services/app-notification.service";

type AppNotificationRouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(
  _: Request,
  { params }: AppNotificationRouteContext
) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const result = await dismissAdminAttentionNotification({
      userId: auth.session.user.id,
      notificationId: id
    });

    revalidatePath("/admin/attention");
    revalidatePath("/admin/notifications");
    revalidatePath("/admin", "layout");

    return ok({
      deletedCount: result.count
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
