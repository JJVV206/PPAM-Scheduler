import { requireSession } from "@/lib/auth/guards";
import { updateAvailabilitySchema } from "@/lib/validations/availability";
import { updateVolunteerAvailability } from "@/services/availability.service";
import { AppError } from "@/services/errors";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function PUT(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = updateAvailabilitySchema.parse(await request.json());
    const volunteerId =
      auth.session.user.role === "ADMIN"
        ? body.volunteerId
        : auth.session.user.volunteerProfileId;

    if (!volunteerId) {
      throw new AppError("Falta el perfil del voluntario.", 400);
    }

    const result = await updateVolunteerAvailability({
      volunteerId,
      items: body.items,
      temporaryUnavailable: body.temporaryUnavailable,
      exceptions: body.exceptions?.map((item) => ({
        startDate: new Date(item.startDate),
        endDate: new Date(item.endDate),
        reason: item.reason
      }))
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
