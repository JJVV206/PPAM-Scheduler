import { resetPasswordSchema } from "@/lib/validations/auth";
import { resetPassword } from "@/services/auth.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function POST(request: Request) {
  try {
    const body = resetPasswordSchema.parse(await request.json());
    await resetPassword(body.token, body.password);
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
