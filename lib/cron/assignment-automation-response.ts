import type { AssignmentAutomationRunResult } from "@/services/assignment-automation.service";

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
