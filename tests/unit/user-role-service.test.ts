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

import { updateUserRole } from "@/services/user.service";

const baseUser = {
  id: "user-1",
  name: "Julia Rivera",
  email: "julia@example.org",
  phone: null,
  active: true,
  createdAt: new Date("2026-06-16T12:00:00.000Z")
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.user.count.mockResolvedValue(1);
  mocks.tx.user.update.mockImplementation(async ({ data }) => ({
    ...baseUser,
    role: data.role
  }));
});

describe("user role service", () => {
  it("promotes a volunteer to admin and pauses the volunteer profile", async () => {
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue({
      ...baseUser,
      role: "VOLUNTEER",
      volunteerProfile: {
        id: "volunteer-1"
      }
    });
    mocks.tx.volunteerProfile.update.mockResolvedValue({
      id: "volunteer-1",
      active: false,
      temporaryUnavailable: true,
      canServeAsReplacement: false
    });

    const result = await updateUserRole({
      userId: "user-1",
      role: "ADMIN"
    });

    expect(mocks.tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { role: "ADMIN" }
      })
    );
    expect(mocks.tx.volunteerProfile.update).toHaveBeenCalledWith({
      where: { id: "volunteer-1" },
      data: {
        active: false,
        temporaryUnavailable: true,
        canServeAsReplacement: false
      },
      select: expect.objectContaining({
        id: true,
        active: true,
        temporaryUnavailable: true,
        canServeAsReplacement: true
      })
    });
    expect(result).toMatchObject({
      id: "user-1",
      role: "ADMIN",
      volunteerProfile: {
        active: false,
        temporaryUnavailable: true,
        canServeAsReplacement: false
      }
    });
  });

  it("demotes an admin to volunteer and creates the missing profile", async () => {
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue({
      ...baseUser,
      role: "ADMIN",
      volunteerProfile: null
    });
    mocks.tx.volunteerProfile.create.mockResolvedValue({
      id: "volunteer-1",
      active: true,
      temporaryUnavailable: false,
      canServeAsReplacement: true
    });

    const result = await updateUserRole({
      userId: "user-1",
      role: "VOLUNTEER"
    });

    expect(mocks.tx.user.count).toHaveBeenCalledWith({
      where: {
        id: { not: "user-1" },
        role: "ADMIN",
        active: true
      }
    });
    expect(mocks.tx.volunteerProfile.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        preferredAreas: [],
        active: true,
        temporaryUnavailable: false,
        canServeAsReplacement: true
      },
      select: expect.objectContaining({
        id: true,
        active: true,
        temporaryUnavailable: true,
        canServeAsReplacement: true
      })
    });
    expect(result).toMatchObject({
      role: "VOLUNTEER",
      volunteerProfile: {
        active: true,
        temporaryUnavailable: false,
        canServeAsReplacement: true
      }
    });
  });

  it("rejects demoting the last active admin", async () => {
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue({
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
