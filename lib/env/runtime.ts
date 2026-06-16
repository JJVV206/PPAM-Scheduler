import { ensureServerEnvLoaded } from "@/lib/env/load-env";
import { getMissingRequiredAuthEnv } from "@/lib/env/config";
import { db } from "@/lib/db/prisma";

ensureServerEnvLoaded();

export type AuthRuntimeStatus = {
  ready: boolean;
  missingEnv: string[];
  message?: string;
};

export async function getAuthRuntimeStatus(): Promise<AuthRuntimeStatus> {
  const missingEnv = getMissingRequiredAuthEnv();

  if (missingEnv.length > 0) {
    return {
      ready: false,
      missingEnv,
      message: `Faltan variables de entorno: ${missingEnv.join(", ")}. Configúralas y reinicia el servidor.`
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
