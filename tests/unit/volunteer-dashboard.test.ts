import { describe, expect, it } from "vitest";

import {
  getVolunteerAssignmentRoleLabel,
  isVolunteerAssignmentConfirmed,
  isVolunteerAssignmentPendingResponse
} from "@/lib/volunteer-assignment";
import type { AssignmentDetailDto } from "@/types/domain";

function assignmentForVolunteer(input: {
  volunteerId: string;
  responseStatus: "PENDING" | "CONFIRMED" | "DECLINED";
  isReplacement?: boolean;
  invitationType?: "PRIMARY" | "REPLACEMENT";
}) {
  return {
    volunteers: [
      {
        volunteerId: input.volunteerId,
        responseStatus: input.responseStatus,
        isReplacement: input.isReplacement ?? false
      }
    ],
    invitations: input.invitationType
      ? [
          {
            volunteerId: input.volunteerId,
            type: input.invitationType
          }
        ]
      : []
  } as AssignmentDetailDto;
}

describe("volunteer dashboard assignment helpers", () => {
  it("detects assignments pending the current volunteer response", () => {
    const assignment = assignmentForVolunteer({
      volunteerId: "volunteer-1",
      responseStatus: "PENDING"
    });

    expect(
      isVolunteerAssignmentPendingResponse(assignment, "volunteer-1")
    ).toBe(true);
    expect(isVolunteerAssignmentConfirmed(assignment, "volunteer-1")).toBe(
      false
    );
  });

  it("detects confirmed assignments for the current volunteer", () => {
    const assignment = assignmentForVolunteer({
      volunteerId: "volunteer-1",
      responseStatus: "CONFIRMED"
    });

    expect(isVolunteerAssignmentConfirmed(assignment, "volunteer-1")).toBe(
      true
    );
  });

  it("shows replacement role when slot or invitation marks the volunteer as replacement", () => {
    expect(
      getVolunteerAssignmentRoleLabel(
        assignmentForVolunteer({
          volunteerId: "volunteer-1",
          responseStatus: "PENDING",
          isReplacement: true
        }),
        "volunteer-1"
      )
    ).toBe("Suplente");

    expect(
      getVolunteerAssignmentRoleLabel(
        assignmentForVolunteer({
          volunteerId: "volunteer-1",
          responseStatus: "PENDING",
          invitationType: "REPLACEMENT"
        }),
        "volunteer-1"
      )
    ).toBe("Suplente");
  });
});
