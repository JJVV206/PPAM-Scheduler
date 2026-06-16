import { NextResponse } from "next/server";

import { buildCronAutomationResponse } from "@/lib/cron/assignment-automation-response";
import { processAssignmentAutomationRun } from "@/services/assignment-automation.service";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store"
} as const;

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
