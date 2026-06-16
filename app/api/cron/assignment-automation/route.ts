import { NextResponse } from "next/server";

import { processAssignmentAutomationRun } from "@/services/assignment-automation.service";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { handleRouteError } from "@/lib/utils/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function unauthorizedCronResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      status: result.status,
      result
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
