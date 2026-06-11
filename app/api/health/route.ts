import { db } from "@/lib/db/prisma";
import {
  getMissingRequiredAppEnv,
  getSmtpConfig,
  isProductionRuntime
} from "@/lib/env/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    appEnv: "ok" as "ok" | "error",
    database: "ok" as "ok" | "error",
    email: "configured" as "configured" | "simulated" | "error"
  };
  const issues: string[] = [];

  const missingEnv = getMissingRequiredAppEnv();
  if (missingEnv.length) {
    checks.appEnv = "error";
    issues.push(`Missing env: ${missingEnv.join(", ")}`);
  }

  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    checks.database = "error";
    issues.push(
      error instanceof Error ? error.message : "Database connection failed."
    );
  }

  try {
    const smtpConfig = getSmtpConfig();
    if (!smtpConfig) {
      checks.email = "simulated";
      if (isProductionRuntime()) {
        checks.email = "error";
        issues.push("SMTP is not configured for production.");
      }
    }
  } catch (error) {
    checks.email = "error";
    issues.push(
      error instanceof Error ? error.message : "SMTP configuration is invalid."
    );
  }

  const status = issues.length ? 503 : 200;

  return Response.json(
    {
      checks,
      issues,
      status: status === 200 ? "ok" : "degraded",
      timestamp: new Date().toISOString()
    },
    { status }
  );
}
