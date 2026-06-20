import { registerSchema } from "@/lib/validations/auth";
import { registerAccount } from "@/services/auth.service";
import { handleRouteError, ok } from "@/lib/utils/api";

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    await registerAccount({
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password
    });

    return ok(
      {
        status: "PENDING_APPROVAL",
        message:
          "Tu solicitud fue recibida. Un administrador debe aprobar tu cuenta antes de que puedas iniciar sesión."
      },
      { status: 202 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
