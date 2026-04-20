import { requireRole } from "@/lib/auth/guards";
import { getAdminDashboardStats } from "@/services/dashboard.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function GET() {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const data = await getAdminDashboardStats();
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
