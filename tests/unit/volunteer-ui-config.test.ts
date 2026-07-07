import { describe, expect, it } from "vitest";

import {
  canAccessVolunteerRoute,
  getVolunteerDashboardModel,
  getVolunteerUiConfig
} from "@/lib/volunteer-ui-config";
import type {
  AssignmentDetailDto,
  OpenSlotDto,
  VolunteerDashboardData,
  VolunteerSummary
} from "@/types/domain";

function volunteer(input: {
  id?: string;
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
  serviceType: VolunteerSummary["serviceType"];
}): VolunteerSummary {
  return {
    id: input.id ?? "volunteer-1",
    userId: "user-1",
    name: "Julia Rivera",
    email: "julia@example.org",
    phone: "5551234567",
    active: true,
    transportationNotes: null,
    preferredAreas: [],
    reliabilityScore: 100,
    confirmationCount: 0,
    declineCount: 0,
    noResponseCount: 0,
    temporaryUnavailable: false,
    canServeAsPrimary: input.canServeAsPrimary,
    canServeAsReplacement: input.canServeAsReplacement,
    serviceType: input.serviceType
  };
}

function assignment(input: {
  id: string;
  volunteerId?: string;
  responseStatus?: "PENDING" | "CONFIRMED" | "DECLINED";
  isReplacement?: boolean;
  invitationType?: "PRIMARY" | "REPLACEMENT";
}): AssignmentDetailDto {
  const volunteerId = input.volunteerId ?? "volunteer-1";

  return {
    id: input.id,
    date: new Date("2026-07-10T12:00:00.000Z"),
    timeSlot: "SLOT_09_11",
    volunteers: [
      {
        volunteerId,
        responseStatus: input.responseStatus ?? "PENDING",
        isReplacement: input.isReplacement ?? false
      }
    ],
    invitations: input.invitationType
      ? [
          {
            volunteerId,
            type: input.invitationType
          }
        ]
      : []
  } as AssignmentDetailDto;
}

function openSlot(id = "assignment-open"): OpenSlotDto {
  return {
    assignmentId: id,
    date: new Date("2026-07-11T12:00:00.000Z"),
    dayOfWeek: "SATURDAY",
    timeSlot: "SLOT_11_13",
    preachingPointId: "point-1",
    preachingPointName: "Hospital",
    area: "Centro",
    status: "NEEDS_REPLACEMENT",
    missingSlotNumbers: [1],
    urgencyLabel: "Alta",
    suggestedVolunteers: []
  };
}

function dashboard(input: {
  volunteer: VolunteerSummary;
  upcomingAssignments?: AssignmentDetailDto[];
  pendingConfirmations?: AssignmentDetailDto[];
  confirmedAssignments?: AssignmentDetailDto[];
  assignmentHistory?: AssignmentDetailDto[];
  openSlots?: OpenSlotDto[];
}): VolunteerDashboardData {
  return {
    volunteer: input.volunteer,
    upcomingAssignments: input.upcomingAssignments ?? [],
    pendingConfirmations: input.pendingConfirmations ?? [],
    confirmedAssignments: input.confirmedAssignments ?? [],
    assignmentHistory: input.assignmentHistory ?? [],
    remindersByAssignmentId: {},
    openSlots: input.openSlots ?? [],
    pendingReplacementCensus: null,
    weeklyAvailabilitySummary: []
  };
}

describe("volunteer UI config", () => {
  it("shows primary-only navigation without suplencias", () => {
    const config = getVolunteerUiConfig(
      volunteer({
        canServeAsPrimary: true,
        canServeAsReplacement: false,
        serviceType: "PRIMARY"
      })
    );

    expect(config.navigationItems.map((item) => item.key)).toEqual([
      "home",
      "assignments",
      "availability",
      "notifications",
      "profile"
    ]);
    expect(config.canSeeOpenSlots).toBe(false);
  });

  it("shows replacement navigation without primary assignments", () => {
    const config = getVolunteerUiConfig(
      volunteer({
        canServeAsPrimary: false,
        canServeAsReplacement: true,
        serviceType: "REPLACEMENT"
      })
    );

    expect(config.navigationItems.map((item) => item.key)).toEqual([
      "home",
      "openSlots",
      "availability",
      "notifications",
      "profile"
    ]);
    expect(config.canSeePrimaryAssignments).toBe(false);
  });

  it("shows mixed navigation with turnos and suplencias", () => {
    const config = getVolunteerUiConfig(
      volunteer({
        canServeAsPrimary: true,
        canServeAsReplacement: true,
        serviceType: "PRIMARY_AND_REPLACEMENT"
      })
    );

    expect(config.navigationItems.map((item) => item.key)).toContain(
      "assignments"
    );
    expect(config.navigationItems.map((item) => item.key)).toContain(
      "openSlots"
    );
  });

  it("guards open slot access by replacement capability", () => {
    expect(
      canAccessVolunteerRoute(
        volunteer({
          canServeAsPrimary: true,
          canServeAsReplacement: false,
          serviceType: "PRIMARY"
        }),
        "openSlots"
      )
    ).toBe(false);
    expect(
      canAccessVolunteerRoute(
        volunteer({
          canServeAsPrimary: false,
          canServeAsReplacement: true,
          serviceType: "REPLACEMENT"
        }),
        "openSlots"
      )
    ).toBe(true);
  });

  it("hides open slots from a primary-only dashboard model", () => {
    const model = getVolunteerDashboardModel(
      dashboard({
        volunteer: volunteer({
          canServeAsPrimary: true,
          canServeAsReplacement: false,
          serviceType: "PRIMARY"
        }),
        pendingConfirmations: [assignment({ id: "primary-pending" })],
        openSlots: [openSlot()]
      })
    );

    expect(model.visibleOpenSlots).toHaveLength(0);
    expect(model.visiblePendingAssignments.map((item) => item.id)).toEqual([
      "primary-pending"
    ]);
  });

  it("prioritizes replacement opportunities for replacement-only volunteers", () => {
    const model = getVolunteerDashboardModel(
      dashboard({
        volunteer: volunteer({
          canServeAsPrimary: false,
          canServeAsReplacement: true,
          serviceType: "REPLACEMENT"
        }),
        openSlots: [openSlot("open-1")]
      })
    );

    expect(model.visibleOpenSlots).toHaveLength(1);
    expect(model.focusOpenSlot?.assignmentId).toBe("open-1");
    expect(model.focusAssignment).toBeUndefined();
  });

  it("prioritizes primary pending assignments before suplencias for mixed volunteers", () => {
    const primaryPending = assignment({ id: "primary-pending" });
    const replacementPending = assignment({
      id: "replacement-pending",
      isReplacement: true,
      invitationType: "REPLACEMENT"
    });
    const model = getVolunteerDashboardModel(
      dashboard({
        volunteer: volunteer({
          canServeAsPrimary: true,
          canServeAsReplacement: true,
          serviceType: "PRIMARY_AND_REPLACEMENT"
        }),
        upcomingAssignments: [replacementPending, primaryPending],
        pendingConfirmations: [replacementPending, primaryPending],
        openSlots: [openSlot()]
      })
    );

    expect(model.focusAssignment?.id).toBe("primary-pending");
    expect(model.visiblePendingAssignments.map((item) => item.id)).toEqual([
      "primary-pending"
    ]);
    expect(model.visibleOpenSlots).toHaveLength(1);
  });
});
