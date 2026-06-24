import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guards";
import { handleRouteError, ok } from "@/lib/utils/api";
import { markAppNotificationRead } from "@/services/app-notification.service";

type AppNotificationReadRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _: Request,
  { params }: AppNotificationReadRouteContext
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const result = await markAppNotificationRead({
      userId: auth.session.user.id,
      notificationId: id
    });

    if (auth.session.user.role === "ADMIN") {
      revalidatePath("/admin/notifications");
      revalidatePath("/admin/attention");
      revalidatePath("/admin", "layout");
    } else {
      revalidatePath("/volunteer/notifications");
      revalidatePath("/volunteer", "layout");
    }

    return ok({
      updatedCount: result.count
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
