import { describe, expect, it } from "vitest";

import {
  deriveAssignmentAutomationState,
  isAssignmentRequiringAttention
} from "@/services/assignment-ui-state.service";
import type {
  AssignmentActivityType,
  AssignmentInvitationStatus,
  AssignmentInvitationType,
  AssignmentStatus,
  ResponseStatus
} from "@/types/domain";

const now = new Date("2026-06-12T12:00:00.000Z");

function invitation(input: {
  type?: AssignmentInvitationType;
  status: AssignmentInvitationStatus;
  createdAt?: Date;
}) {
  return {
    type: input.type ?? "PRIMARY",
    status: input.status,
    createdAt: input.createdAt ?? now
  };
}

function volunteer(responseStatus: ResponseStatus) {
  return {
    responseStatus
  };
}

function activity(actionType: AssignmentActivityType) {
  return {
    actionType,
    createdAt: now
  };
}

function stateInput(input: {
  status?: AssignmentStatus;
  invitations?: ReturnType<typeof invitation>[];
  volunteers?: ReturnType<typeof volunteer>[];
  timeline?: ReturnType<typeof activity>[];
}) {
  return {
    status: input.status ?? "PENDING_CONFIRMATION",
    invitations: input.invitations ?? [],
    volunteers: input.volunteers ?? [],
    timeline: input.timeline ?? []
  };
}

describe("assignment automation UI state", () => {
  it("shows sent primary invitations as awaiting response when volunteers are pending", () => {
    const state = deriveAssignmentAutomationState(
      stateInput({
        invitations: [invitation({ status: "SENT" })],
        volunteers: [volunteer("PENDING")]
      })
    );

    expect(state.key).toBe("AWAITING_RESPONSE");
  });

  it("prioritizes active replacement invitations over replacement search", () => {
    const state = deriveAssignmentAutomationState(
      stateInput({
        status: "NEEDS_REPLACEMENT",
        invitations: [
          invitation({
            type: "REPLACEMENT",
            status: "SENT"
          })
        ],
        volunteers: [volunteer("DECLINED")]
      })
    );

    expect(state.key).toBe("REPLACEMENT_INVITED");
  });

  it("flags admin alerts as requiring attention", () => {
    const input = stateInput({
      status: "NEEDS_REPLACEMENT",
      timeline: [activity("ADMIN_ALERTED")]
    });

    expect(deriveAssignmentAutomationState(input).key).toBe(
      "REQUIRES_INTERVENTION"
    );
    expect(isAssignmentRequiringAttention(input)).toBe(true);
  });

  it("does not keep resolved assignments in the attention queue", () => {
    const input = stateInput({
      status: "CONFIRMED",
      volunteers: [volunteer("DECLINED")],
      timeline: [activity("ADMIN_ALERTED")]
    });

    expect(deriveAssignmentAutomationState(input).key).toBe("CONFIRMED");
    expect(isAssignmentRequiringAttention(input)).toBe(false);
  });

  it("prioritizes resolved coverage over stale replacement invitations", () => {
    const input = stateInput({
      status: "CONFIRMED",
      invitations: [
        invitation({
          type: "REPLACEMENT",
          status: "SENT"
        })
      ],
      volunteers: [volunteer("CONFIRMED")]
    });

    expect(deriveAssignmentAutomationState(input).key).toBe("CONFIRMED");
    expect(isAssignmentRequiringAttention(input)).toBe(false);
  });

  it("treats accepted invitations as confirmed while the assignment catches up", () => {
    const input = stateInput({
      status: "PENDING_CONFIRMATION",
      invitations: [invitation({ status: "ACCEPTED" })],
      volunteers: [volunteer("PENDING")]
    });

    expect(deriveAssignmentAutomationState(input).key).toBe("CONFIRMED");
  });

  it("does not mark unsent assignments as confirmed", () => {
    const input = stateInput({
      status: "SCHEDULED",
      volunteers: [volunteer("PENDING")]
    });

    expect(deriveAssignmentAutomationState(input).key).toBe(
      "INVITATION_PENDING"
    );
  });

  it("keeps cancelled assignments out of the attention queue", () => {
    const input = stateInput({
      status: "CANCELLED",
      invitations: [invitation({ status: "SENT" })],
      volunteers: [volunteer("PENDING")]
    });

    expect(deriveAssignmentAutomationState(input).key).toBe("CANCELLED");
    expect(isAssignmentRequiringAttention(input)).toBe(false);
  });

  it("flags the latest failed invitation as requiring intervention", () => {
    const input = stateInput({
      invitations: [invitation({ status: "FAILED" })],
      volunteers: [volunteer("PENDING")]
    });

    expect(deriveAssignmentAutomationState(input).key).toBe(
      "REQUIRES_INTERVENTION"
    );
    expect(isAssignmentRequiringAttention(input)).toBe(true);
  });
});
