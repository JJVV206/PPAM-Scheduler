import { ensureServerEnvLoaded } from "@/lib/env/load-env";
import { db } from "@/lib/db/prisma";

ensureServerEnvLoaded();

const REQUIRED_AUTH_ENV = ["DATABASE_URL"] as const;

export type AuthRuntimeStatus = {
  ready: boolean;
  missingEnv: string[];
  message?: string;
};

export async function getAuthRuntimeStatus(): Promise<AuthRuntimeStatus> {
  const missingEnv = REQUIRED_AUTH_ENV.filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    return {
      ready: false,
      missingEnv,
      message: `Faltan variables de entorno: ${missingEnv.join(", ")}. Crea .env.local o .env y reinicia el servidor de desarrollo.`
    };
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return {
      ready: true,
      missingEnv: []
    };
  } catch (error) {
    return {
      ready: false,
      missingEnv: [],
      message:
        error instanceof Error
          ? `Falló la conexión con la base de datos: ${error.message}`
          : "Falló la conexión con la base de datos. Revisa DATABASE_URL y confirma que PostgreSQL esté en ejecución."
    };
  }
}
