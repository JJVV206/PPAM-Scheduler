import { db } from "@/lib/db/prisma";
import {
  getMissingRequiredAppEnv,
  getSmtpConfig,
  isProductionRuntime
} from "@/lib/env/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const checks = {
    appEnv: "ok" as "ok" | "error",
    database: "ok" as "ok" | "error"
  };
  const readiness = {
    email: "configured" as "configured" | "simulated" | "error"
  };
  const coreIssues: string[] = [];
  const readinessIssues: string[] = [];
  const scope = new URL(request.url).searchParams.get("scope");
  const requireReadiness = scope === "readiness";

  const missingEnv = getMissingRequiredAppEnv();
  if (missingEnv.length) {
    checks.appEnv = "error";
    coreIssues.push(`Missing env: ${missingEnv.join(", ")}`);
  }

  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    checks.database = "error";
    coreIssues.push(
      error instanceof Error ? error.message : "Database connection failed."
    );
  }

  try {
    const smtpConfig = getSmtpConfig();
    if (!smtpConfig) {
      readiness.email = "simulated";
      if (isProductionRuntime()) {
        readiness.email = "error";
        readinessIssues.push("SMTP is not configured for production.");
      }
    }
  } catch (error) {
    readiness.email = "error";
    readinessIssues.push(
      error instanceof Error ? error.message : "SMTP configuration is invalid."
    );
  }

  const hasCoreIssues = coreIssues.length > 0;
  const hasReadinessIssues = readinessIssues.length > 0;
  const status =
    hasCoreIssues || (requireReadiness && hasReadinessIssues) ? 503 : 200;
  const responseStatus = hasCoreIssues
    ? "down"
    : hasReadinessIssues
      ? requireReadiness
        ? "degraded"
        : "core_ok"
      : "ok";

  return Response.json(
    {
      checks,
      coreIssues,
      readiness: {
        checks: readiness,
        issues: readinessIssues,
        status: hasReadinessIssues ? "degraded" : "ok"
      },
      scope: requireReadiness ? "readiness" : "core",
      status: responseStatus,
      timestamp: new Date().toISOString()
    },
    { status }
  );
}
