import { db } from "@/lib/db/prisma";
import {
  getEmailDeliveryConfig,
  getMissingRequiredAppEnv,
  isProductionRuntime
} from "@/lib/env/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const checks = {
    appEnv: "ok" as "ok" | "error",
    database: "ok" as "ok" | "error"
  };
  const readiness = {
    email: "configured" as "configured" | "simulated" | "error",
    emailProvider: null as "resend" | "smtp" | null
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
    const emailConfig = getEmailDeliveryConfig();
    if (!emailConfig) {
      readiness.email = "simulated";
      if (isProductionRuntime()) {
        readiness.email = "error";
        readinessIssues.push("Email delivery is not configured for production.");
      }
    } else {
      readiness.emailProvider = emailConfig.provider;
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
