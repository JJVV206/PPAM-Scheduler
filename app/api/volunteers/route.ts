import { randomBytes } from "crypto";

import { requireRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { createVolunteerSchema } from "@/lib/validations/volunteer";
import { createVolunteer, getVolunteers } from "@/services/volunteer.service";
import { handleRouteError, ok } from "@/lib/utils/api";
import { requestPasswordReset } from "@/services/auth.service";

export async function GET() {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const volunteers = await getVolunteers();
    return ok(volunteers);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["ADMIN"]);
    if ("error" in auth) return auth.error;
    const body = createVolunteerSchema.parse(await request.json());
    const temporaryPassword = randomBytes(8).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);

    const result = await createVolunteer({
      ...body,
      preferredAreas: body.preferredAreas ?? [],
      passwordHash
    });

    await requestPasswordReset(result.email);

    return ok(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
