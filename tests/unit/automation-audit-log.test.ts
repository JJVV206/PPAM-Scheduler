import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    automationAuditLog: {
      create: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import {
  AUTOMATION_AUDIT_EVENTS,
  recordAutomationAuditLog
} from "@/services/automation-audit-log.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.automationAuditLog.create.mockResolvedValue({ id: "log-1" });
});

describe("automation audit logs", () => {
  it("lists the important events from the free automation plan", () => {
    expect(AUTOMATION_AUDIT_EVENTS).toEqual(
      expect.arrayContaining([
        "WEEK_CREATED",
        "PRIMARY_INVITATION_CREATED",
        "PRIMARY_EMAIL_SENT",
        "CENSUS_CREATED",
        "CENSUS_SENT",
        "CENSUS_RESPONDED",
        "REPLACEMENT_SELECTED",
        "REPLACEMENT_INVITATION_SENT",
        "NO_REPLACEMENT_AVAILABLE",
        "ADMIN_ALERTED",
        "ASSIGNMENT_COVERED",
        "MANUAL_OVERRIDE"
      ])
    );
  });

  it("writes sanitized technical audit metadata", async () => {
    await recordAutomationAuditLog({
      eventType: "CENSUS_SENT",
      censusId: "census-1",
      automationRunId: "run-1",
      metadata: {
        token: "secret",
        responseUrl: "https://example.org/replacement-census/secret",
        sentAt: new Date("2026-06-16T12:00:00.000Z"),
        nested: {
          resetToken: "secret",
          kept: "value"
        }
      }
    });

    expect(mocks.db.automationAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "CENSUS_SENT",
        eventCategory: "census",
        status: "SUCCESS",
        censusId: "census-1",
        automationRunId: "run-1",
        metadata: {
          auditSchemaVersion: 1,
          sentAt: "2026-06-16T12:00:00.000Z",
          nested: {
            kept: "value"
          }
        }
      })
    });
  });
});
