import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    assignment: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    assignmentActivity: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    assignmentInvitation: {
      findMany: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    assignmentResponse: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn()
    },
    assignmentVolunteer: {
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    appNotification: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    volunteerProfile: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    assignment: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    assignmentInvitation: {
      count: vi.fn(),
      findUnique: vi.fn()
    },
    assignmentVolunteer: {
      findMany: vi.fn()
    },
    preachingPoint: {
      findUniqueOrThrow: vi.fn()
    },
    notificationLog: {
      count: vi.fn()
    },
    replacementCensus: {
      findFirst: vi.fn()
    },
    scheduleWeek: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    volunteerProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  };

  return {
    tx,
    db,
    createPendingPrimaryInvitationsForAssignment: vi.fn(),
    getAssignmentInvitationAvailability: vi.fn(),
    getAppSettings: vi.fn(),
    getSingletonPreachingPoint: vi.fn(),
    inviteNextAvailableReplacementForAssignment: vi.fn(),
    prepareScheduleWeekAutomation: vi.fn(),
    recordAssignmentAuditActivity: vi.fn(),
    sendPendingPrimaryInvitationsForAssignment: vi.fn()
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/services/point.service", () => ({
  getSingletonPreachingPoint: mocks.getSingletonPreachingPoint
}));
vi.mock("@/services/setting.service", () => ({
  getAppSettings: mocks.getAppSettings
}));
vi.mock("@/services/assignment-audit.service", () => ({
  recordAssignmentAuditActivity: mocks.recordAssignmentAuditActivity
}));
vi.mock("@/services/assignment-automation.service", () => ({
  inviteNextAvailableReplacementForAssignment:
    mocks.inviteNextAvailableReplacementForAssignment
}));
vi.mock("@/services/schedule-week-preparation.service", () => ({
  prepareScheduleWeekAutomation: mocks.prepareScheduleWeekAutomation
}));
vi.mock("@/services/assignment-invitation.service", () => ({
  ACTIVE_ASSIGNMENT_INVITATION_STATUSES: ["PENDING", "SENT"],
  buildAssignmentInvitationResponseUrl: vi.fn(
    (token: string) => `https://ppam.example.org/confirm-assignment/${token}`
  ),
  createPendingPrimaryInvitationsForAssignment:
    mocks.createPendingPrimaryInvitationsForAssignment,
  getAssignmentInvitationAvailability:
    mocks.getAssignmentInvitationAvailability,
  sendPendingPrimaryInvitationsForAssignment:
    mocks.sendPendingPrimaryInvitationsForAssignment
}));

import {
  assignReplacementVolunteer,
  confirmAssignment,
  createWeeklyAssignment,
  declineAssignment,
  duplicateScheduleWeek,
  getAdminDashboardStats,
  getAssignmentDetail,
  getAssignments,
  getAssignmentsForScheduleSlot,
  getSameDayVolunteerRepeatWarnings,
  getWeeklySchedule,
  respondToAssignmentInvitation,
  updateAssignment
} from "@/services/assignment.service";

const fixedPoint = {
  id: "point-1",
  name: "Hospital Dr José G. Parres",
  area: "North",
  notes: null,
  active: true,
  activeSlots: []
};

function user(id: string, name = id) {
  return {
    id: `user-${id}`,
    name,
    email: `${id}@example.org`,
    phone: "5551234567",
    active: true
  };
}

function volunteer(id: string, name = id) {
  return {
    id,
    userId: `user-${id}`,
    transportationNotes: null,
    preferredAreas: [],
    reliabilityScore: 90,
    confirmationCount: 0,
    declineCount: 0,
    noResponseCount: 0,
    active: true,
    temporaryUnavailable: false,
    user: user(id, name)
  };
}

function assignmentDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "assignment-1",
    scheduleWeekId: "week-1",
    date: new Date(2026, 6, 20),
    dayOfWeek: "MONDAY",
    timeSlot: "SLOT_11_13",
    preachingPointId: fixedPoint.id,
    pairNumber: 1,
    status: "SCHEDULED",
    notes: null,
    preachingPoint: fixedPoint,
    volunteers: [],
    responses: [],
    activities: [],
    invitations: [],
    ...overrides
  };
}

function assignmentSlot(volunteerId: string, position: "FIRST" | "SECOND") {
  return {
    id: `slot-${volunteerId}`,
    assignmentId: "assignment-1",
    volunteerId,
    position,
    isReplacement: false,
    volunteer: volunteer(volunteerId)
  };
}

function response(
  volunteerId: string,
  responseStatus: "PENDING" | "CONFIRMED" | "DECLINED"
) {
  return {
    id: `response-${volunteerId}`,
    assignmentId: "assignment-1",
    volunteerId,
    responseStatus,
    note: null,
    respondedAt: null
  };
}

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "invitation-1",
    assignmentId: "assignment-1",
    volunteerId: "volunteer-1",
    type: "PRIMARY",
    status: "SENT",
    token: "token-1",
    sentAt: new Date("2026-06-15T12:00:00.000Z"),
    respondedAt: null,
    expiresAt: new Date("2026-06-17T12:00:00.000Z"),
    emailAttempts: 1,
    metadata: {},
    createdAt: new Date("2026-06-15T12:00:00.000Z"),
    updatedAt: new Date("2026-06-15T12:00:00.000Z"),
    ...overrides
  };
}

function setupAssignmentDefaults() {
  let createdCount = 0;
  mocks.getSingletonPreachingPoint.mockResolvedValue(fixedPoint);
  mocks.getAppSettings.mockResolvedValue({ confirmationLeadDays: 7 });
  mocks.db.preachingPoint.findUniqueOrThrow.mockResolvedValue(fixedPoint);
  mocks.db.assignmentVolunteer.findMany.mockResolvedValue([]);
  mocks.db.volunteerProfile.findMany.mockImplementation(
    async ({ where }: { where: { id?: { in?: string[] } } }) =>
      (where.id?.in ?? []).map((id) => ({
        id,
        canServeAsPrimary: true,
        user: {
          name: `Voluntario ${id}`
        }
      }))
  );
  mocks.db.volunteerProfile.findUnique.mockResolvedValue({
    active: true,
    temporaryUnavailable: false,
    canServeAsReplacement: true,
    user: {
      name: "Replacement Candidate",
      active: true,
      accessStatus: "APPROVED"
    }
  });
  mocks.tx.assignment.aggregate.mockResolvedValue({
    _max: { pairNumber: null }
  });
  mocks.tx.assignment.create.mockImplementation(async ({ data }) => {
    createdCount += 1;
    return {
      id: `assignment-${createdCount}`,
      ...data
    };
  });
  mocks.tx.assignmentResponse.findMany.mockResolvedValue([]);
  mocks.tx.assignmentVolunteer.findUnique.mockImplementation(
    async ({
      where
    }: {
      where: {
        assignmentId_volunteerId: {
          assignmentId: string;
          volunteerId: string;
        };
      };
    }) => ({
      id: `slot-${where.assignmentId_volunteerId.volunteerId}`
    })
  );
  mocks.tx.assignment.findUniqueOrThrow.mockResolvedValue(
    assignmentDetail({
      volunteers: [
        assignmentSlot("volunteer-1", "FIRST"),
        assignmentSlot("volunteer-2", "SECOND")
      ],
      responses: [
        response("volunteer-1", "PENDING"),
        response("volunteer-2", "PENDING")
      ]
    })
  );
  mocks.db.assignment.findUniqueOrThrow.mockResolvedValue(
    assignmentDetail({
      volunteers: [
        assignmentSlot("volunteer-1", "FIRST"),
        assignmentSlot("volunteer-2", "SECOND")
      ],
      responses: [
        response("volunteer-1", "PENDING"),
        response("volunteer-2", "PENDING")
      ]
    })
  );
  mocks.db.assignment.findMany.mockResolvedValue([]);
  mocks.db.assignmentInvitation.count.mockResolvedValue(0);
  mocks.db.notificationLog.count.mockResolvedValue(0);
  mocks.db.replacementCensus.findFirst.mockResolvedValue(null);
  mocks.createPendingPrimaryInvitationsForAssignment.mockResolvedValue({
    createdCount: 2,
    skippedCount: 0
  });
  mocks.sendPendingPrimaryInvitationsForAssignment.mockResolvedValue({
    totalCount: 2,
    sentCount: 2,
    failedCount: 0,
    results: []
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupAssignmentDefaults();
  mocks.getAssignmentInvitationAvailability.mockReturnValue("READY");
  mocks.tx.assignment.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.assignmentActivity.findFirst.mockResolvedValue(null);
  mocks.tx.appNotification.findFirst.mockResolvedValue(null);
  mocks.tx.appNotification.create.mockResolvedValue({
    id: "app-notification-1"
  });
  mocks.tx.appNotification.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.volunteerProfile.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => ({
      userId: `user-${where.id}`
    })
  );
  mocks.inviteNextAvailableReplacementForAssignment.mockResolvedValue({
    assignmentId: "assignment-1",
    status: "invited",
    candidateId: "replacement-1",
    sentCount: 1,
    failedCount: 0
  });
  mocks.prepareScheduleWeekAutomation.mockResolvedValue({
    scheduleWeekId: "target-week",
    assignmentCount: 2,
    primaryInvitations: {
      createdCount: 0,
      skippedCount: 4,
      sentCount: 0,
      failedCount: 0
    },
    replacementCensus: {
      censusId: "census-1",
      replacementCount: 4,
      createdResponseCount: 4,
      skippedResponseCount: 0,
      sentCount: 4,
      failedCount: 0
    }
  });
});

describe("assignment automation orchestration", () => {
  it("creates primary invitations and sends them when a new assignment has titular volunteers", async () => {
    await createWeeklyAssignment({
      scheduleWeekId: "week-1",
      date: new Date(2026, 6, 20),
      dayOfWeek: "MONDAY",
      timeSlot: "SLOT_11_13",
      preachingPointId: fixedPoint.id,
      volunteers: [
        { volunteerId: "volunteer-1", position: "FIRST" },
        { volunteerId: "volunteer-2", position: "SECOND" }
      ],
      actorUserId: "admin-1"
    });

    expect(
      mocks.createPendingPrimaryInvitationsForAssignment
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: "assignment-1",
        volunteerIds: ["volunteer-1", "volunteer-2"],
        actorUserId: "admin-1",
        source: "assignment_created"
      })
    );
    expect(
      mocks.sendPendingPrimaryInvitationsForAssignment
    ).toHaveBeenCalledWith({
      assignmentId: "assignment-1",
      actorUserId: "admin-1"
    });
  });

  it("rejects primary assignments for volunteers without primary capacity", async () => {
    mocks.db.volunteerProfile.findMany.mockResolvedValueOnce([
      {
        id: "replacement-only",
        canServeAsPrimary: false,
        user: {
          name: "Solo Suplente"
        }
      }
    ]);

    await expect(
      createWeeklyAssignment({
        scheduleWeekId: "week-1",
        date: new Date(2026, 6, 20),
        dayOfWeek: "MONDAY",
        timeSlot: "SLOT_11_13",
        preachingPointId: fixedPoint.id,
        volunteers: [{ volunteerId: "replacement-only", position: "FIRST" }],
        actorUserId: "admin-1"
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.tx.assignment.create).not.toHaveBeenCalled();
  });

  it("allows assignments on any slot for the fixed preaching point even if legacy active slots exist", async () => {
    mocks.getSingletonPreachingPoint.mockResolvedValueOnce({
      ...fixedPoint,
      activeSlots: [
        {
          id: "slot-legacy",
          preachingPointId: fixedPoint.id,
          dayOfWeek: "TUESDAY",
          timeSlot: "SLOT_09_11"
        }
      ]
    });

    await createWeeklyAssignment({
      scheduleWeekId: "week-1",
      date: new Date(2026, 5, 22),
      dayOfWeek: "MONDAY",
      timeSlot: "SLOT_07_09",
      preachingPointId: fixedPoint.id,
      volunteers: [
        { volunteerId: "volunteer-1", position: "FIRST" },
        { volunteerId: "volunteer-2", position: "SECOND" }
      ],
      actorUserId: "admin-1"
    });

    expect(mocks.tx.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dayOfWeek: "MONDAY",
          timeSlot: "SLOT_07_09"
        })
      })
    );
    expect(mocks.db.preachingPoint.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("returns no same-day warning when selected volunteers have no other assignments that day", async () => {
    mocks.db.assignmentVolunteer.findMany.mockResolvedValueOnce([]);

    const result = await getSameDayVolunteerRepeatWarnings({
      date: new Date("2026-07-20T12:00:00.000Z"),
      timeSlot: "SLOT_07_09",
      volunteerIds: ["volunteer-1", "volunteer-2"]
    });

    expect(result).toEqual({
      warnings: [],
      repeatedVolunteerIds: [],
      repeatedVolunteers: []
    });
  });

  it("returns yellow-warning payload when a selected volunteer is assigned in another time slot that day", async () => {
    mocks.db.assignmentVolunteer.findMany.mockResolvedValueOnce([
      {
        volunteerId: "volunteer-1",
        volunteer: {
          user: {
            name: "Julia Westbrook"
          }
        },
        assignment: {
          id: "assignment-existing",
          timeSlot: "SLOT_09_11"
        }
      }
    ]);

    const result = await getSameDayVolunteerRepeatWarnings({
      date: new Date("2026-07-20T12:00:00.000Z"),
      timeSlot: "SLOT_07_09",
      volunteerIds: ["volunteer-1", "volunteer-2"]
    });

    expect(result).toEqual({
      warnings: [
        "Julia Westbrook ya tiene asignación este día en 09:00 - 11:00. Revisa si debe cubrir ambos horarios."
      ],
      repeatedVolunteerIds: ["volunteer-1"],
      repeatedVolunteers: [
        {
          volunteerId: "volunteer-1",
          volunteerName: "Julia Westbrook",
          timeSlots: ["SLOT_09_11"],
          assignmentIds: ["assignment-existing"]
        }
      ]
    });
  });

  it("excludes cancelled assignments and the current assignment from same-day preflight", async () => {
    mocks.db.assignmentVolunteer.findMany.mockResolvedValueOnce([]);

    await getSameDayVolunteerRepeatWarnings({
      assignmentId: "assignment-current",
      date: new Date("2026-07-20T12:00:00.000Z"),
      timeSlot: "SLOT_07_09",
      volunteerIds: ["volunteer-1"]
    });

    expect(mocks.db.assignmentVolunteer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignment: expect.objectContaining({
            id: { not: "assignment-current" },
            status: { notIn: ["CANCELLED"] },
            timeSlot: { not: "SLOT_07_09" }
          })
        })
      })
    );
  });

  it("keeps exact same-day and same-time volunteer conflicts blocking", async () => {
    mocks.db.assignmentVolunteer.findMany.mockResolvedValueOnce([
      {
        volunteer: {
          user: {
            name: "Julia Westbrook"
          }
        },
        assignment: {
          preachingPoint: fixedPoint
        }
      }
    ]);

    await expect(
      createWeeklyAssignment({
        scheduleWeekId: "week-1",
        date: new Date(2026, 6, 20),
        dayOfWeek: "MONDAY",
        timeSlot: "SLOT_11_13",
        preachingPointId: fixedPoint.id,
        volunteers: [{ volunteerId: "volunteer-1", position: "FIRST" }],
        actorUserId: "admin-1"
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.tx.assignment.create).not.toHaveBeenCalled();
  });

  it("persists same-day repeat warnings in assignment detail responses", async () => {
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValueOnce(
      assignmentDetail({
        volunteers: [assignmentSlot("volunteer-1", "FIRST")]
      })
    );
    mocks.db.assignment.findMany.mockResolvedValueOnce([
      {
        id: "assignment-1",
        date: new Date(2026, 6, 20),
        timeSlot: "SLOT_11_13",
        status: "SCHEDULED",
        volunteers: [{ volunteerId: "volunteer-1" }]
      },
      {
        id: "assignment-2",
        date: new Date(2026, 6, 20),
        timeSlot: "SLOT_13_15",
        status: "SCHEDULED",
        volunteers: [{ volunteerId: "volunteer-1" }]
      }
    ]);

    const result = await getAssignmentDetail("assignment-1");

    expect(result.warnings).toContain("Integrante repetido este día");
  });

  it("hides cancelled assignments from assignment lists by default", async () => {
    await getAssignments();

    expect(mocks.db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "CANCELLED" }
        })
      })
    );
  });

  it("allows explicitly requesting cancelled assignments in assignment lists", async () => {
    await getAssignments({ status: "CANCELLED" });

    expect(mocks.db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "CANCELLED"
        })
      })
    );
  });

  it("hides cancelled assignments from the weekly schedule by default", async () => {
    await getWeeklySchedule({
      weekStart: new Date("2026-07-20T12:00:00.000Z")
    });

    expect(mocks.db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "CANCELLED" }
        })
      })
    );
  });

  it("allows explicitly requesting cancelled assignments in the weekly schedule", async () => {
    await getWeeklySchedule({
      weekStart: new Date("2026-07-20T12:00:00.000Z"),
      filters: {
        status: "CANCELLED"
      }
    });

    expect(mocks.db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "CANCELLED"
        })
      })
    );
  });

  it("hides cancelled assignments from schedule slot views", async () => {
    await getAssignmentsForScheduleSlot({
      date: new Date("2026-07-20T12:00:00.000Z"),
      timeSlot: "SLOT_13_15"
    });

    expect(mocks.db.assignment.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "CANCELLED" }
        })
      })
    );
  });

  it("keeps cancelled assignments available through direct detail reads", async () => {
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValueOnce(
      assignmentDetail({
        status: "CANCELLED"
      })
    );

    const result = await getAssignmentDetail("assignment-1");

    expect(result.status).toBe("CANCELLED");
  });

  it("hides cancelled assignments from admin dashboard operational totals", async () => {
    await getAdminDashboardStats();

    expect(mocks.db.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "CANCELLED" }
        })
      })
    );
  });

  it("duplicates a week and generates titular invitations for every copied assignment", async () => {
    mocks.db.scheduleWeek.findUnique.mockResolvedValue(null);
    mocks.db.scheduleWeek.create.mockResolvedValue({
      id: "target-week",
      startDate: new Date(2026, 6, 20),
      endDate: new Date(2026, 6, 26),
      label: "Del 20 al 26 de julio de 2026",
      createdById: "admin-1"
    });
    mocks.db.scheduleWeek.findUniqueOrThrow.mockResolvedValue({
      id: "source-week",
      startDate: new Date(2026, 6, 13),
      assignments: [
        {
          id: "source-assignment-1",
          date: new Date(2026, 6, 13),
          dayOfWeek: "MONDAY",
          timeSlot: "SLOT_11_13",
          preachingPointId: fixedPoint.id,
          pairNumber: 1,
          notes: null,
          volunteers: [
            { volunteerId: "volunteer-1", position: "FIRST" },
            { volunteerId: "volunteer-2", position: "SECOND" }
          ]
        },
        {
          id: "source-assignment-2",
          date: new Date(2026, 6, 14),
          dayOfWeek: "TUESDAY",
          timeSlot: "SLOT_09_11",
          preachingPointId: fixedPoint.id,
          pairNumber: 1,
          notes: null,
          volunteers: [
            { volunteerId: "volunteer-3", position: "FIRST" },
            { volunteerId: "volunteer-4", position: "SECOND" }
          ]
        }
      ]
    });

    await duplicateScheduleWeek({
      sourceWeekId: "source-week",
      targetWeekStart: new Date(2026, 6, 20),
      actorUserId: "admin-1"
    });

    expect(
      mocks.createPendingPrimaryInvitationsForAssignment
    ).toHaveBeenCalledTimes(2);
    expect(
      mocks.sendPendingPrimaryInvitationsForAssignment
    ).toHaveBeenCalledTimes(2);
    expect(mocks.prepareScheduleWeekAutomation).toHaveBeenCalledWith({
      scheduleWeekId: "target-week",
      actorUserId: "admin-1"
    });
    expect(
      mocks.createPendingPrimaryInvitationsForAssignment
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        assignmentId: "assignment-2",
        volunteerIds: ["volunteer-3", "volunteer-4"],
        source: "assignment_created"
      })
    );
  });

  it("invalidates prior titular invitations and sends new ones when admins change titular volunteers", async () => {
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValueOnce(
      assignmentDetail({
        volunteers: [
          assignmentSlot("volunteer-1", "FIRST"),
          assignmentSlot("volunteer-2", "SECOND")
        ],
        responses: [
          response("volunteer-1", "PENDING"),
          response("volunteer-2", "PENDING")
        ]
      })
    );
    mocks.tx.assignment.update.mockResolvedValue({
      id: "assignment-1"
    });
    mocks.tx.assignmentInvitation.findMany.mockResolvedValue([
      invitation({
        id: "invitation-old",
        volunteerId: "volunteer-1",
        status: "SENT"
      })
    ]);
    mocks.tx.assignmentVolunteer.deleteMany.mockResolvedValue({ count: 2 });
    mocks.tx.assignmentVolunteer.createMany.mockResolvedValue({ count: 2 });
    mocks.tx.assignment.findUniqueOrThrow.mockResolvedValue(
      assignmentDetail({
        volunteers: [
          assignmentSlot("volunteer-3", "FIRST"),
          assignmentSlot("volunteer-2", "SECOND")
        ],
        responses: [
          response("volunteer-3", "PENDING"),
          response("volunteer-2", "PENDING")
        ]
      })
    );

    await updateAssignment("assignment-1", {
      volunteers: [
        { volunteerId: "volunteer-3", position: "FIRST" },
        { volunteerId: "volunteer-2", position: "SECOND" }
      ],
      actorUserId: "admin-1"
    });

    expect(mocks.tx.assignmentInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invitation-old" },
        data: expect.objectContaining({
          status: "EXPIRED"
        })
      })
    );
    expect(mocks.recordAssignmentAuditActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "INVITATION_EXPIRED",
        dedupeKey: "invitation-invalidated:invitation-old",
        metadata: expect.objectContaining({
          reason: "primary_volunteer_changed_after_send"
        })
      })
    );
    expect(
      mocks.createPendingPrimaryInvitationsForAssignment
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: "assignment-1",
        volunteerIds: ["volunteer-3", "volunteer-2"],
        source: "assignment_updated",
        metadata: {
          addedVolunteerIds: ["volunteer-3"],
          removedVolunteerIds: ["volunteer-1"]
        }
      })
    );
    expect(
      mocks.sendPendingPrimaryInvitationsForAssignment
    ).toHaveBeenCalledWith({
      assignmentId: "assignment-1",
      actorUserId: "admin-1"
    });
  });

  it("confirms a titular invitation and records a confirmed assignment response", async () => {
    const primaryInvitation = invitation();
    mocks.db.assignmentInvitation.findUnique.mockResolvedValue(
      primaryInvitation
    );
    mocks.tx.assignmentInvitation.findUniqueOrThrow.mockResolvedValue(
      primaryInvitation
    );
    mocks.tx.assignment.findUniqueOrThrow.mockResolvedValue(
      assignmentDetail({
        status: "CONFIRMED",
        volunteers: [
          assignmentSlot("volunteer-1", "FIRST"),
          assignmentSlot("volunteer-2", "SECOND")
        ],
        responses: [
          response("volunteer-1", "CONFIRMED"),
          response("volunteer-2", "CONFIRMED")
        ]
      })
    );

    await respondToAssignmentInvitation({
      token: "token-1",
      responseStatus: "CONFIRMED",
      note: "Disponible"
    });

    expect(mocks.tx.assignmentInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invitation-1" },
        data: expect.objectContaining({ status: "ACCEPTED" })
      })
    );
    expect(mocks.tx.assignmentResponse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ responseStatus: "CONFIRMED" }),
        update: expect.objectContaining({ responseStatus: "CONFIRMED" })
      })
    );
  });

  it("declines a titular invitation and triggers automatic replacement search", async () => {
    const primaryInvitation = invitation();
    mocks.db.assignmentInvitation.findUnique.mockResolvedValue(
      primaryInvitation
    );
    mocks.tx.assignmentInvitation.findUniqueOrThrow.mockResolvedValue(
      primaryInvitation
    );
    mocks.tx.assignment.findUniqueOrThrow.mockResolvedValue(
      assignmentDetail({
        status: "NEEDS_REPLACEMENT",
        volunteers: [
          assignmentSlot("volunteer-1", "FIRST"),
          assignmentSlot("volunteer-2", "SECOND")
        ],
        responses: [
          response("volunteer-1", "DECLINED"),
          response("volunteer-2", "PENDING")
        ]
      })
    );

    await respondToAssignmentInvitation({
      token: "token-1",
      responseStatus: "DECLINED"
    });

    expect(mocks.tx.assignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { status: "NEEDS_REPLACEMENT" }
    });
    expect(
      mocks.inviteNextAvailableReplacementForAssignment
    ).toHaveBeenCalledWith({
      assignmentId: "assignment-1"
    });
  });

  it("blocks direct confirmation when the volunteer is not assigned", async () => {
    mocks.tx.assignmentVolunteer.findUnique.mockResolvedValue(null);

    await expect(
      confirmAssignment({
        assignmentId: "assignment-1",
        volunteerProfileId: "volunteer-3"
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mocks.tx.assignmentResponse.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.volunteerProfile.update).not.toHaveBeenCalled();
  });

  it("blocks direct decline when the volunteer is not assigned", async () => {
    mocks.tx.assignmentVolunteer.findUnique.mockResolvedValue(null);

    await expect(
      declineAssignment({
        assignmentId: "assignment-1",
        volunteerProfileId: "volunteer-3",
        note: "No puedo apoyar"
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mocks.tx.assignmentResponse.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.assignment.update).not.toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { status: "NEEDS_REPLACEMENT" }
    });
    expect(
      mocks.inviteNextAvailableReplacementForAssignment
    ).not.toHaveBeenCalled();
  });

  it("assigns a manual replacement to the declined volunteer position", async () => {
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValueOnce(
      assignmentDetail({
        status: "NEEDS_REPLACEMENT",
        volunteers: [
          assignmentSlot("volunteer-1", "FIRST"),
          assignmentSlot("volunteer-2", "SECOND")
        ],
        responses: [
          response("volunteer-1", "DECLINED"),
          response("volunteer-2", "CONFIRMED")
        ]
      })
    );

    await assignReplacementVolunteer({
      assignmentId: "assignment-1",
      volunteerId: "replacement-1",
      actorUserId: "admin-1"
    });

    expect(mocks.tx.assignmentVolunteer.delete).toHaveBeenCalledWith({
      where: { id: "slot-volunteer-1" }
    });
    expect(mocks.tx.assignmentVolunteer.create).toHaveBeenCalledWith({
      data: {
        assignmentId: "assignment-1",
        volunteerId: "replacement-1",
        position: "FIRST",
        isReplacement: true
      }
    });
  });

  it("rejects manual replacement for volunteers without replacement capacity", async () => {
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValueOnce(
      assignmentDetail({
        status: "NEEDS_REPLACEMENT",
        volunteers: [
          assignmentSlot("volunteer-1", "FIRST"),
          assignmentSlot("volunteer-2", "SECOND")
        ],
        responses: [
          response("volunteer-1", "DECLINED"),
          response("volunteer-2", "CONFIRMED")
        ]
      })
    );
    mocks.db.volunteerProfile.findUnique.mockResolvedValueOnce({
      active: true,
      temporaryUnavailable: false,
      canServeAsReplacement: false,
      user: {
        name: "Solo Titular",
        active: true,
        accessStatus: "APPROVED"
      }
    });

    await expect(
      assignReplacementVolunteer({
        assignmentId: "assignment-1",
        volunteerId: "primary-only",
        actorUserId: "admin-1"
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.tx.assignmentVolunteer.create).not.toHaveBeenCalled();
  });

  it("blocks self-service replacement when the assignment has no open slot", async () => {
    mocks.db.assignment.findUniqueOrThrow.mockResolvedValueOnce(
      assignmentDetail({
        status: "SCHEDULED",
        volunteers: [
          assignmentSlot("volunteer-1", "FIRST"),
          assignmentSlot("volunteer-2", "SECOND")
        ],
        responses: [
          response("volunteer-1", "PENDING"),
          response("volunteer-2", "PENDING")
        ]
      })
    );

    await expect(
      assignReplacementVolunteer({
        assignmentId: "assignment-1",
        volunteerId: "replacement-1",
        actorUserId: "volunteer-user",
        requireOpenSlot: true
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.tx.assignmentVolunteer.create).not.toHaveBeenCalled();
    expect(mocks.tx.assignmentVolunteer.delete).not.toHaveBeenCalled();
  });

  it("accepts a replacement invitation and assigns the volunteer as confirmed replacement", async () => {
    const replacementInvitation = invitation({
      id: "replacement-invitation",
      volunteerId: "replacement-1",
      type: "REPLACEMENT"
    });
    mocks.db.assignmentInvitation.findUnique.mockResolvedValue(
      replacementInvitation
    );
    mocks.tx.assignmentInvitation.findUniqueOrThrow.mockResolvedValue(
      replacementInvitation
    );
    mocks.tx.assignment.findUniqueOrThrow
      .mockResolvedValueOnce({
        id: "assignment-1",
        status: "NEEDS_REPLACEMENT",
        volunteers: [
          {
            id: "slot-volunteer-1",
            volunteerId: "volunteer-1",
            position: "FIRST"
          },
          {
            id: "slot-volunteer-2",
            volunteerId: "volunteer-2",
            position: "SECOND"
          }
        ],
        responses: [
          response("volunteer-1", "DECLINED"),
          response("volunteer-2", "CONFIRMED")
        ]
      })
      .mockResolvedValue(
        assignmentDetail({
          status: "REASSIGNED",
          volunteers: [
            {
              ...assignmentSlot("replacement-1", "FIRST"),
              isReplacement: true
            },
            assignmentSlot("volunteer-2", "SECOND")
          ],
          responses: [
            response("replacement-1", "CONFIRMED"),
            response("volunteer-2", "CONFIRMED")
          ]
        })
      );

    await respondToAssignmentInvitation({
      token: "replacement-token",
      responseStatus: "CONFIRMED"
    });

    expect(mocks.tx.assignmentVolunteer.delete).toHaveBeenCalledWith({
      where: { id: "slot-volunteer-1" }
    });
    expect(mocks.tx.assignmentVolunteer.create).toHaveBeenCalledWith({
      data: {
        assignmentId: "assignment-1",
        volunteerId: "replacement-1",
        position: "FIRST",
        isReplacement: true
      }
    });
    expect(mocks.tx.assignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { status: "REASSIGNED" }
    });
    expect(mocks.tx.assignmentResponse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          volunteerId: "replacement-1",
          responseStatus: "CONFIRMED"
        })
      })
    );
  });

  it("declines a replacement invitation and tries the next candidate", async () => {
    const replacementInvitation = invitation({
      id: "replacement-invitation",
      volunteerId: "replacement-1",
      type: "REPLACEMENT"
    });
    mocks.db.assignmentInvitation.findUnique.mockResolvedValue(
      replacementInvitation
    );
    mocks.tx.assignmentInvitation.findUniqueOrThrow.mockResolvedValue(
      replacementInvitation
    );
    mocks.tx.assignment.findUniqueOrThrow.mockResolvedValue(
      assignmentDetail({
        status: "NEEDS_REPLACEMENT",
        volunteers: [assignmentSlot("volunteer-1", "FIRST")],
        responses: [response("replacement-1", "DECLINED")]
      })
    );

    await respondToAssignmentInvitation({
      token: "replacement-token",
      responseStatus: "DECLINED"
    });

    expect(mocks.tx.assignmentInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DECLINED" })
      })
    );
    expect(
      mocks.inviteNextAvailableReplacementForAssignment
    ).toHaveBeenCalledWith({
      assignmentId: "assignment-1"
    });
  });

  it("rejects an expired token before recording a response", async () => {
    mocks.getAssignmentInvitationAvailability.mockReturnValue("EXPIRED");
    mocks.db.assignmentInvitation.findUnique.mockResolvedValue(
      invitation({
        status: "SENT",
        expiresAt: new Date("2026-06-12T11:59:59.000Z")
      })
    );

    await expect(
      respondToAssignmentInvitation({
        token: "expired-token",
        responseStatus: "CONFIRMED"
      })
    ).rejects.toMatchObject({ statusCode: 410 });

    expect(mocks.tx.assignmentResponse.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.assignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "assignment-1",
          status: {
            notIn: ["CANCELLED", "COMPLETED"]
          }
        }),
        data: { status: "NEEDS_REPLACEMENT" }
      })
    );
    expect(
      mocks.inviteNextAvailableReplacementForAssignment
    ).toHaveBeenCalledWith({
      assignmentId: "assignment-1"
    });
  });

  it("rejects an already responded token without changing the response", async () => {
    mocks.getAssignmentInvitationAvailability.mockReturnValue("RESPONDED");
    mocks.db.assignmentInvitation.findUnique.mockResolvedValue(
      invitation({
        status: "ACCEPTED",
        respondedAt: new Date("2026-06-15T13:00:00.000Z")
      })
    );

    await expect(
      respondToAssignmentInvitation({
        token: "responded-token",
        responseStatus: "DECLINED"
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
