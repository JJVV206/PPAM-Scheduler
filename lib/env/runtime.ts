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
      message: `Missing environment variables: ${missingEnv.join(", ")}. Create .env.local or .env, then restart the dev server.`
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
          ? `Database connection failed: ${error.message}`
          : "Database connection failed. Check DATABASE_URL and that PostgreSQL is running."
    };
  }
}
