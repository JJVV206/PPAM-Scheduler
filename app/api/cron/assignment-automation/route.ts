import { NextResponse } from "next/server";

import { processAssignmentAutomationRun } from "@/services/assignment-automation.service";
import type { AssignmentAutomationRunResult } from "@/services/assignment-automation.service";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store"
} as const;

export function buildCronAutomationResponse(
  result: AssignmentAutomationRunResult
) {
  return {
    status: result.status,
    automationRunId: result.automationRunId,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
    failedStepCount: result.failedStepCount,
    summarySaved: result.summarySaved
  };
}

function unauthorizedCronResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: NO_STORE_HEADERS
    }
  );
}

export async function GET(request: Request) {
  try {
    if (
      !isAuthorizedCronRequest({
        authorizationHeader: request.headers.get("authorization"),
        cronSecret: process.env.CRON_SECRET
      })
    ) {
      return unauthorizedCronResponse();
    }

    const result = await processAssignmentAutomationRun();

    return NextResponse.json(buildCronAutomationResponse(result), {
      headers: NO_STORE_HEADERS
    });
  } catch (error) {
    console.error("Assignment automation cron failed", error);

    return NextResponse.json(
      { error: "Cron execution failed" },
      {
        status: 500,
        headers: NO_STORE_HEADERS
      }
    );
  }
}
