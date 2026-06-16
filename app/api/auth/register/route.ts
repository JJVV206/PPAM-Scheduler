import { registerSchema } from "@/lib/validations/auth";
import { registerAccount } from "@/services/auth.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const account = await registerAccount({
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password
    });

    return ok(account, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
