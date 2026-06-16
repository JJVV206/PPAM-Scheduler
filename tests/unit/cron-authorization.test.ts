import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processAssignmentAutomationRun: vi.fn()
}));

vi.mock("@/services/assignment-automation.service", () => ({
  processAssignmentAutomationRun: mocks.processAssignmentAutomationRun
}));

import {
  GET,
  buildCronAutomationResponse
} from "@/app/api/cron/assignment-automation/route";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import type { AssignmentAutomationRunResult } from "@/services/assignment-automation.service";

const originalCronSecret = process.env.CRON_SECRET;

function cronRequest(authorizationHeader?: string) {
  return new Request("https://ppam.example.org/api/cron/assignment-automation", {
    headers: authorizationHeader
      ? {
          authorization: authorizationHeader
        }
      : undefined
  });
}

function automationResult(
  overrides?: Partial<AssignmentAutomationRunResult>
): AssignmentAutomationRunResult {
  return {
    status: "completed",
    automationRunId: "automation-run-1",
    startedAt: "2026-06-16T10:00:00.000Z",
    finishedAt: "2026-06-16T10:00:02.000Z",
    durationMs: 2000,
    failedStepCount: 0,
    summarySaved: true,
    sendPendingPrimaryInvitations: {
      status: "completed",
      processedCount: 1,
      skippedCount: 0,
      sentCount: 1,
      failedCount: 0,
      detail: "smtp://secret-value"
    },
    ...overrides
  } as AssignmentAutomationRunResult;
}

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  mocks.processAssignmentAutomationRun.mockReset();
});

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }

  vi.restoreAllMocks();
});

describe("isAuthorizedCronRequest", () => {
  it("accepts the expected bearer token", () => {
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: "Bearer cron-secret",
        cronSecret: "cron-secret"
      })
    ).toBe(true);
  });

  it("rejects missing or mismatched bearer tokens", () => {
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: null,
        cronSecret: "cron-secret"
      })
    ).toBe(false);
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: "Bearer wrong-secret",
        cronSecret: "cron-secret"
      })
    ).toBe(false);
  });

  it("rejects every request when the cron secret is not configured", () => {
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: "Bearer cron-secret"
      })
    ).toBe(false);
  });
});

describe("assignment automation cron route", () => {
  it("rejects unauthenticated requests without running automation", async () => {
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mocks.processAssignmentAutomationRun).not.toHaveBeenCalled();
  });

  it("runs automation for authorized requests and returns a non-sensitive summary", async () => {
    mocks.processAssignmentAutomationRun.mockResolvedValueOnce(automationResult());

    const response = await GET(cronRequest("Bearer cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "completed",
      automationRunId: "automation-run-1",
      startedAt: "2026-06-16T10:00:00.000Z",
      finishedAt: "2026-06-16T10:00:02.000Z",
      durationMs: 2000,
      failedStepCount: 0,
      summarySaved: true
    });
    expect(JSON.stringify(body)).not.toContain("smtp://secret-value");
    expect(body).not.toHaveProperty("result");
    expect(mocks.processAssignmentAutomationRun).toHaveBeenCalledTimes(1);
  });

  it("does not expose thrown error details", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.processAssignmentAutomationRun.mockRejectedValueOnce(
      new Error("database password leaked")
    );

    const response = await GET(cronRequest("Bearer cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Cron execution failed" });
    expect(JSON.stringify(body)).not.toContain("database password leaked");
    expect(consoleError).toHaveBeenCalledWith(
      "Assignment automation cron failed",
      expect.any(Error)
    );
  });

  it("keeps the public cron response limited to operational fields", () => {
    expect(buildCronAutomationResponse(automationResult())).toEqual({
      status: "completed",
      automationRunId: "automation-run-1",
      startedAt: "2026-06-16T10:00:00.000Z",
      finishedAt: "2026-06-16T10:00:02.000Z",
      durationMs: 2000,
      failedStepCount: 0,
      summarySaved: true
    });
  });
});

describe("vercel cron configuration", () => {
  it("runs assignment automation every 30 minutes", () => {
    const vercelConfig = JSON.parse(
      readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")
    );

    expect(vercelConfig.crons).toEqual(
      expect.arrayContaining([
        {
          path: "/api/cron/assignment-automation",
          schedule: "*/30 * * * *"
        }
      ])
    );
  });
});
