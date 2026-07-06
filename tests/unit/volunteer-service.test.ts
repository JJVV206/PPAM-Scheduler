import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    assignment: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    assignmentActivity: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    assignmentInvitation: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    assignmentResponse: {
      upsert: vi.fn()
    },
    user: {
      update: vi.fn()
    },
    volunteerProfile: {
      update: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    volunteerProfile: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn()
    }
  };

  return { db, tx };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/services/assignment.service", () => ({
  getOpenSlots: vi.fn(),
  getVolunteerHistory: vi.fn()
}));

import {
  deactivateVolunteer,
  getVolunteers
} from "@/services/volunteer.service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"));

  mocks.db.volunteerProfile.findUniqueOrThrow.mockResolvedValue({
    id: "volunteer-1",
    userId: "user-1",
    user: {
      id: "user-1",
      active: true
    }
  });
  mocks.db.volunteerProfile.findMany.mockResolvedValue([]);
  mocks.tx.assignmentInvitation.findMany.mockResolvedValue([
    {
      id: "invitation-1",
      metadata: {
        source: "assignment_created"
      }
    }
  ]);
  mocks.tx.assignment.findMany.mockResolvedValue([
    {
      id: "assignment-1",
      status: "SCHEDULED",
      volunteers: [
        {
          volunteerId: "volunteer-1",
          slotNumber: 1
        }
      ]
    }
  ]);
  mocks.tx.assignmentActivity.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("volunteer service", () => {
  it("filters active volunteers when requested", async () => {
    await getVolunteers({ activeOnly: true });

    expect(mocks.db.volunteerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          user: {
            active: true,
            accessStatus: "APPROVED"
          }
        }
      })
    );
  });

  it("deactivates a volunteer and marks future assignments for replacement", async () => {
    const result = await deactivateVolunteer("volunteer-1", {
      actorUserId: "admin-1"
    });

    expect(mocks.tx.volunteerProfile.update).toHaveBeenCalledWith({
      where: { id: "volunteer-1" },
      data: {
        active: false,
        temporaryUnavailable: true,
        canServeAsPrimary: false,
        canServeAsReplacement: false
      }
    });
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        active: false,
        accessStatus: "SUSPENDED"
      }
    });
    expect(mocks.tx.assignmentInvitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: expect.objectContaining({
        status: "EXPIRED",
        metadata: expect.objectContaining({
          source: "assignment_created",
          expiredBy: "ADMIN_VOLUNTEER_DELETION",
          actorUserId: "admin-1"
        })
      })
    });
    expect(mocks.tx.assignmentResponse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assignmentId_volunteerId: {
            assignmentId: "assignment-1",
            volunteerId: "volunteer-1"
          }
        },
        update: expect.objectContaining({
          responseStatus: "DECLINED"
        }),
        create: expect.objectContaining({
          responseStatus: "DECLINED"
        })
      })
    );
    expect(mocks.tx.assignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { status: "NEEDS_REPLACEMENT" }
    });
    expect(mocks.tx.assignmentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId: "assignment-1",
          actorUserId: "admin-1",
          actionType: "REPLACEMENT_REQUIRED",
          metadata: expect.objectContaining({
            reason: "volunteer_deleted",
            volunteerProfileId: "volunteer-1",
            slotNumber: 1
          })
        })
      })
    );
    expect(result).toEqual({
      success: true,
      affectedAssignmentCount: 1,
      expiredInvitationCount: 1
    });
  });
});
