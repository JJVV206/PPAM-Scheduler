import { requireRole } from "@/lib/auth/guards";
import { updateSettingsSchema } from "@/lib/validations/settings";
import { getAppSettings, updateSettings } from "@/services/setting.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function GET() {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const settings = await getAppSettings();
    return ok(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const body = updateSettingsSchema.parse(await request.json());
    const settings = await updateSettings(body);
    return ok(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}
