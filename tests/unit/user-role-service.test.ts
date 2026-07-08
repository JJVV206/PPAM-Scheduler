import { beforeEach, describe, expect, it, vi } from "vitest";

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
    passwordResetToken: {
      deleteMany: vi.fn()
    },
    session: {
      deleteMany: vi.fn()
    },
    user: {
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    userAccountAuditLog: {
      create: vi.fn()
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
vi.mock("@/services/replacement-census.service", () => ({
  syncReplacementVolunteerWithOpenCensuses: vi.fn()
}));

import {
  anonymizeUserAccount,
  reactivateUserAccount,
  reviewUserAdmission,
  suspendUserAccount,
  updateOwnAccountName,
  updateUserAccountName,
  updateUserRole
} from "@/services/user.service";

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
  mocks.tx.assignment.findMany.mockResolvedValue([]);
  mocks.tx.assignmentActivity.findFirst.mockResolvedValue(null);
  mocks.tx.assignmentInvitation.findMany.mockResolvedValue([]);
  mocks.tx.user.count.mockResolvedValue(1);
  mocks.tx.user.update.mockResolvedValue({});
  mocks.tx.userAccountAuditLog.create.mockResolvedValue({});
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

describe("user account lifecycle service", () => {
  it("updates a user's own account name and records audit", async () => {
    mocks.tx.user.update.mockResolvedValueOnce(
      accountResult({ name: "Julia Actualizada" })
    );

    const result = await updateOwnAccountName({
      userId: "user-1",
      name: " Julia Actualizada "
    });

    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Julia Actualizada" },
      select: expect.any(Object)
    });
    expect(mocks.tx.userAccountAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetUserId: "user-1",
        actorUserId: "user-1",
        action: "NAME_CHANGE"
      })
    });
    expect(result.name).toBe("Julia Actualizada");
  });

  it("lets admins update another account name and records audit", async () => {
    mocks.tx.user.findUniqueOrThrow.mockResolvedValueOnce({
      id: "user-1",
      email: "julia@example.org"
    });
    mocks.tx.user.update.mockResolvedValueOnce(
      accountResult({ name: "Julia Admin" })
    );

    const result = await updateUserAccountName({
      userId: "user-1",
      actorUserId: "admin-1",
      name: "Julia Admin"
    });

    expect(mocks.tx.userAccountAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetUserId: "user-1",
        actorUserId: "admin-1",
        action: "NAME_CHANGE",
        metadata: { source: "admin" }
      })
    });
    expect(result.name).toBe("Julia Admin");
  });

  it("suspends an approved volunteer and marks future assignments for replacement", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...baseUser,
        role: "VOLUNTEER",
        volunteerProfile: { id: "volunteer-1" }
      })
      .mockResolvedValueOnce(
        accountResult({
          active: false,
          accessStatus: "SUSPENDED",
          volunteerProfile: {
            id: "volunteer-1",
            active: false,
            temporaryUnavailable: true,
            canServeAsPrimary: false,
            canServeAsReplacement: false
          }
        })
      );
    mocks.tx.assignmentInvitation.findMany.mockResolvedValueOnce([
      {
        id: "invitation-1",
        metadata: {
          source: "assignment_created"
        }
      }
    ]);
    mocks.tx.assignment.findMany.mockResolvedValueOnce([
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

    const result = await suspendUserAccount({
      userId: "user-1",
      actorUserId: "admin-1",
      note: "Fuera temporalmente"
    });

    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        active: false,
        accessStatus: "SUSPENDED",
        accessReviewedById: "admin-1",
        accessReviewNote: "Fuera temporalmente"
      })
    });
    expect(mocks.tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" }
    });
    expect(mocks.tx.assignmentInvitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: expect.objectContaining({
        status: "EXPIRED",
        metadata: expect.objectContaining({
          expiredBy: "ADMIN_ACCOUNT_SUSPENSION"
        })
      })
    });
    expect(mocks.tx.assignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { status: "NEEDS_REPLACEMENT" }
    });
    expect(mocks.tx.userAccountAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SUSPEND",
        note: "Fuera temporalmente",
        metadata: expect.objectContaining({
          affectedAssignmentCount: 1,
          expiredInvitationCount: 1
        })
      })
    });
    expect(result).toMatchObject({
      active: false,
      accessStatus: "SUSPENDED"
    });
  });

  it("does not let admins suspend themselves", async () => {
    await expect(
      suspendUserAccount({
        userId: "admin-1",
        actorUserId: "admin-1"
      })
    ).rejects.toMatchObject({
      statusCode: 409
    });

    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("requires explicit volunteer capacity when reactivating a volunteer", async () => {
    mocks.tx.user.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseUser,
      active: false,
      accessStatus: "SUSPENDED",
      role: "VOLUNTEER",
      volunteerProfile: { id: "volunteer-1" }
    });

    await expect(
      reactivateUserAccount({
        userId: "user-1",
        actorUserId: "admin-1"
      })
    ).rejects.toMatchObject({
      statusCode: 400
    });

    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });

  it("reactivates suspended volunteer accounts with selected capacity", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...baseUser,
        active: false,
        accessStatus: "SUSPENDED",
        role: "VOLUNTEER",
        volunteerProfile: { id: "volunteer-1" }
      })
      .mockResolvedValueOnce(accountResult());

    const result = await reactivateUserAccount({
      userId: "user-1",
      actorUserId: "admin-1",
      canServeAsPrimary: true,
      canServeAsReplacement: false
    });

    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        active: true,
        accessStatus: "APPROVED",
        accessReviewedById: "admin-1"
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
    expect(mocks.tx.userAccountAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "REACTIVATE",
        metadata: expect.objectContaining({
          canServeAsPrimary: true,
          canServeAsReplacement: false
        })
      })
    });
    expect(result).toMatchObject({
      active: true,
      accessStatus: "APPROVED"
    });
  });

  it("anonymizes inactive accounts without storing previous PII in audit metadata", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...baseUser,
        active: false,
        accessStatus: "SUSPENDED",
        role: "VOLUNTEER",
        volunteerProfile: { id: "volunteer-1" }
      })
      .mockResolvedValueOnce(
        accountResult({
          name: "Usuario eliminado",
          email: "deleted+user-1@ppam.local",
          phone: "deleted-user-1",
          active: false,
          accessStatus: "SUSPENDED",
          volunteerProfile: {
            id: "volunteer-1",
            active: false,
            temporaryUnavailable: true,
            canServeAsPrimary: false,
            canServeAsReplacement: false
          }
        })
      );

    const result = await anonymizeUserAccount({
      userId: "user-1",
      actorUserId: "admin-1",
      confirmationEmail: "julia@example.org"
    });

    expect(mocks.tx.volunteerProfile.update).toHaveBeenCalledWith({
      where: { id: "volunteer-1" },
      data: expect.objectContaining({
        active: false,
        notes: null,
        transportationNotes: null,
        preferredAreas: []
      })
    });
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        email: "deleted+user-1@ppam.local",
        name: "Usuario eliminado",
        phone: "deleted-user-1",
        active: false,
        accessStatus: "SUSPENDED"
      })
    });
    expect(mocks.tx.userAccountAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ANONYMIZE",
        metadata: {
          previousRole: "VOLUNTEER",
          previousAccessStatus: "SUSPENDED",
          hadVolunteerProfile: true
        }
      })
    });
    expect(
      mocks.tx.userAccountAuditLog.create.mock.calls[0][0].data.metadata
    ).not.toHaveProperty("email");
    expect(result.email).toBe("deleted+user-1@ppam.local");
  });
});
