import { requireRole } from "@/lib/auth/guards";
import { AppError } from "@/services/errors";
import { getVolunteerDashboardData } from "@/services/dashboard.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function GET() {
  try {
    const auth = await requireRole(["VOLUNTEER"]);
    if ("error" in auth) return auth.error;
    if (!auth.session.user.volunteerProfileId) {
      throw new AppError("Falta el perfil del voluntario.", 400);
    }
    const data = await getVolunteerDashboardData(auth.session.user.volunteerProfileId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
