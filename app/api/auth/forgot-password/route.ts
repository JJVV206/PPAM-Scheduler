import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/services/auth.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function POST(request: Request) {
  try {
    const body = forgotPasswordSchema.parse(await request.json());
    await requestPasswordReset(body.email);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
