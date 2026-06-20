import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    volunteerProfile: {
      create: vi.fn(),
      update: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    user: {
      findMany: vi.fn()
    }
  };

  return { db, tx };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import { reviewUserAdmission, updateUserRole } from "@/services/user.service";

const baseUser = {
  id: "user-1",
  name: "Julia Rivera",
  email: "julia@example.org",
  phone: "5551234567",
  active: true,
  accessStatus: "APPROVED",
  accessReviewedAt: null,
  accessReviewNote: null,
  accessReviewedBy: null,
  createdAt: new Date("2026-06-16T12:00:00.000Z")
};

const activeVolunteerProfile = {
  id: "volunteer-1",
  active: true,
  temporaryUnavailable: false,
  canServeAsPrimary: true,
  canServeAsReplacement: true
};

function accountResult(overrides: Record<string, unknown> = {}) {
  return {
    ...baseUser,
    role: "VOLUNTEER",
    volunteerProfile: activeVolunteerProfile,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.user.count.mockResolvedValue(1);
  mocks.tx.user.update.mockResolvedValue({});
  mocks.tx.volunteerProfile.create.mockResolvedValue(activeVolunteerProfile);
  mocks.tx.volunteerProfile.update.mockResolvedValue(activeVolunteerProfile);
});

describe("user role service", () => {
  it("promotes a volunteer to admin and pauses the volunteer profile", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...baseUser,
        role: "VOLUNTEER",
        volunteerProfile: { id: "volunteer-1" }
      })
      .mockResolvedValueOnce(
        accountResult({
          role: "ADMIN",
          volunteerProfile: {
            id: "volunteer-1",
            active: false,
            temporaryUnavailable: true,
            canServeAsPrimary: false,
            canServeAsReplacement: false
          }
        })
      );

    const result = await updateUserRole({
      userId: "user-1",
      role: "ADMIN"
    });

    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "ADMIN" }
    });
    expect(mocks.tx.volunteerProfile.update).toHaveBeenCalledWith({
      where: { id: "volunteer-1" },
      data: {
        active: false,
        temporaryUnavailable: true,
        canServeAsPrimary: false,
        canServeAsReplacement: false
      },
      select: expect.objectContaining({
        id: true,
        active: true,
        temporaryUnavailable: true,
        canServeAsPrimary: true,
        canServeAsReplacement: true
      })
    });
    expect(result).toMatchObject({
      id: "user-1",
      role: "ADMIN",
      volunteerProfile: {
        active: false,
        temporaryUnavailable: true,
        canServeAsPrimary: false,
        canServeAsReplacement: false
      }
    });
  });

  it("demotes an admin to volunteer and creates the missing profile", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...baseUser,
        role: "ADMIN",
        volunteerProfile: null
      })
      .mockResolvedValueOnce(
        accountResult({
          volunteerProfile: {
            id: "volunteer-1",
            active: true,
            temporaryUnavailable: false,
            canServeAsPrimary: true,
            canServeAsReplacement: false
          }
        })
      );

    const result = await updateUserRole({
      userId: "user-1",
      role: "VOLUNTEER"
    });

    expect(mocks.tx.user.count).toHaveBeenCalledWith({
      where: {
        id: { not: "user-1" },
        role: "ADMIN",
        active: true,
        accessStatus: "APPROVED"
      }
    });
    expect(mocks.tx.volunteerProfile.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        preferredAreas: [],
        active: true,
        temporaryUnavailable: false,
        canServeAsPrimary: true,
        canServeAsReplacement: false
      },
      select: expect.objectContaining({
        id: true,
        active: true,
        temporaryUnavailable: true,
        canServeAsPrimary: true,
        canServeAsReplacement: true
      })
    });
    expect(result).toMatchObject({
      role: "VOLUNTEER",
      volunteerProfile: {
        active: true,
        temporaryUnavailable: false,
        canServeAsPrimary: true,
        canServeAsReplacement: false
      }
    });
  });

  it("rejects role changes for accounts that are not approved", async () => {
    mocks.tx.user.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseUser,
      active: false,
      accessStatus: "PENDING_APPROVAL",
      role: "VOLUNTEER",
      volunteerProfile: { id: "volunteer-1" }
    });

    await expect(
      updateUserRole({
        userId: "user-1",
        role: "ADMIN"
      })
    ).rejects.toMatchObject({
      statusCode: 409
    });

    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });

  it("rejects demoting the last active approved admin", async () => {
    mocks.tx.user.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseUser,
      role: "ADMIN",
      volunteerProfile: null
    });
    mocks.tx.user.count.mockResolvedValue(0);

    await expect(
      updateUserRole({
        userId: "user-1",
        role: "VOLUNTEER"
      })
    ).rejects.toMatchObject({
      statusCode: 409
    });

    expect(mocks.tx.user.update).not.toHaveBeenCalled();
    expect(mocks.tx.volunteerProfile.create).not.toHaveBeenCalled();
  });
});

describe("user admission service", () => {
  it("approves pending volunteer accounts and activates the profile", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...baseUser,
        active: false,
        accessStatus: "PENDING_APPROVAL",
        role: "VOLUNTEER",
        volunteerProfile: { id: "volunteer-1" }
      })
      .mockResolvedValueOnce(accountResult());

    const result = await reviewUserAdmission({
      userId: "user-1",
      actorUserId: "admin-1",
      decision: "APPROVE"
    });

    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        active: true,
        accessStatus: "APPROVED",
        accessReviewedById: "admin-1",
        accessReviewNote: null
      })
    });
    expect(mocks.tx.volunteerProfile.update).toHaveBeenCalledWith({
      where: { id: "volunteer-1" },
      data: {
        active: true,
        temporaryUnavailable: false,
        canServeAsPrimary: true,
        canServeAsReplacement: false
      }
    });
    expect(result).toMatchObject({
      active: true,
      accessStatus: "APPROVED"
    });
  });

  it("rejects pending volunteer accounts and keeps them inactive", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...baseUser,
        active: false,
        accessStatus: "PENDING_APPROVAL",
        role: "VOLUNTEER",
        volunteerProfile: { id: "volunteer-1" }
      })
      .mockResolvedValueOnce(
        accountResult({
          active: false,
          accessStatus: "REJECTED",
          accessReviewNote: "No coincide con la lista interna.",
          volunteerProfile: {
            id: "volunteer-1",
            active: false,
            temporaryUnavailable: true,
            canServeAsPrimary: false,
            canServeAsReplacement: false
          }
        })
      );

    const result = await reviewUserAdmission({
      userId: "user-1",
      actorUserId: "admin-1",
      decision: "REJECT",
      note: "No coincide con la lista interna."
    });

    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        active: false,
        accessStatus: "REJECTED",
        accessReviewedById: "admin-1",
        accessReviewNote: "No coincide con la lista interna."
      })
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
    expect(result).toMatchObject({
      active: false,
      accessStatus: "REJECTED"
    });
  });
});
