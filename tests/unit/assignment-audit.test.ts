import { describe, expect, it } from "vitest";

import {
  ASSIGNMENT_AUDIT_EVENT_ACTIONS,
  ASSIGNMENT_AUDIT_EVENTS,
  buildAssignmentAuditMetadata,
  compactAssignmentAuditMetadata
} from "@/services/assignment-audit.service";

describe("assignment audit helpers", () => {
  it("covers the automation events required by the email assignment plan", () => {
    expect(ASSIGNMENT_AUDIT_EVENTS).toEqual([
      "ASSIGNED",
      "REPLACEMENT_REQUIRED",
      "RESPONSE_RECEIVED",
      "INVITATION_CREATED",
      "INVITATION_SENT",
      "INVITATION_FAILED",
      "INVITATION_ACCEPTED",
      "INVITATION_DECLINED",
      "INVITATION_EXPIRED",
      "REPLACEMENT_ASSIGNED",
      "REPLACEMENT_SELECTED",
      "NO_REPLACEMENT_AVAILABLE",
      "ADMIN_ALERTED",
      "REMINDER_SENT",
      "ASSIGNMENT_COVERED",
      "MANUAL_OVERRIDE",
      "NOTES_UPDATED",
      "CANCELLED"
    ]);
    expect(ASSIGNMENT_AUDIT_EVENT_ACTIONS.INVITATION_CREATED).toBe(
      "INVITATION_CREATED"
    );
    expect(ASSIGNMENT_AUDIT_EVENT_ACTIONS.REPLACEMENT_SELECTED).toBe(
      "REPLACEMENT_SELECTED"
    );
  });

  it("adds stable audit metadata for timeline and filtering", () => {
    const metadata = buildAssignmentAuditMetadata({
      event: "INVITATION_SENT",
      dedupeKey: "invitation-sent:1",
      metadata: {
        invitationId: "invitation-1",
        volunteerProfileId: "volunteer-1"
      }
    });

    expect(metadata).toMatchObject({
      auditEvent: "INVITATION_SENT",
      auditSchemaVersion: 1,
      automationModule: "assignment_automation",
      dedupeKey: "invitation-sent:1",
      invitationId: "invitation-1",
      volunteerProfileId: "volunteer-1"
    });
  });

  it("compacts unsafe metadata before writing JSON audit records", () => {
    const metadata = compactAssignmentAuditMetadata({
      kept: "value",
      dropped: undefined,
      invalidNumber: Number.NaN,
      bigintValue: BigInt(3),
      happenedAt: new Date("2026-06-16T12:00:00.000Z"),
      nested: {
        kept: true,
        dropped: undefined
      },
      list: ["ok", undefined, new Date("2026-06-16T13:00:00.000Z")],
      token: "do-not-store",
      responseUrl: "https://example.org/confirm/secret-token"
    });

    expect(metadata).toEqual({
      kept: "value",
      bigintValue: "3",
      happenedAt: "2026-06-16T12:00:00.000Z",
      nested: {
        kept: true
      },
      list: ["ok", "2026-06-16T13:00:00.000Z"]
    });
  });
});
