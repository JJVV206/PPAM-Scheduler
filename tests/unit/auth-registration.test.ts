import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      count: vi.fn(),
      create: vi.fn()
    }
  };
  const db = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
    user: {
      findUnique: vi.fn()
    }
  };

  return {
    db,
    hashPassword: vi.fn(),
    tx
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword
}));
vi.mock("@/services/notification.service", () => ({
  sendEmailNotification: vi.fn()
}));

import { registerSchema } from "@/lib/validations/auth";
import { registerAccount } from "@/services/auth.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.user.findUnique.mockResolvedValue(null);
  mocks.hashPassword.mockResolvedValue("hashed-password");
});

describe("auth registration", () => {
  it("validates matching strong passwords", () => {
    const result = registerSchema.safeParse({
      name: "Julia Rivera",
      email: "julia@example.org",
      phone: "",
      password: "Password1",
      confirmPassword: "Password2"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
        "Las contraseñas no coinciden."
      );
    }
  });

  it("creates the first account as admin for local bootstrap", async () => {
    mocks.tx.user.count.mockResolvedValue(0);
    mocks.tx.user.create.mockResolvedValue({
      id: "user-1",
      name: "Admin Local",
      email: "admin@example.org",
      role: "ADMIN",
      volunteerProfile: null
    });

    const account = await registerAccount({
      name: " Admin Local ",
      email: "ADMIN@EXAMPLE.ORG",
      password: "Password1"
    });

    expect(account).toEqual({
      id: "user-1",
      name: "Admin Local",
      email: "admin@example.org",
      role: "ADMIN",
      volunteerProfileId: null
    });
    expect(mocks.tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Admin Local",
          email: "admin@example.org",
          role: "ADMIN",
          volunteerProfile: undefined
        })
      })
    );
  });

  it("creates later accounts as volunteer profiles", async () => {
    mocks.tx.user.count.mockResolvedValue(1);
    mocks.tx.user.create.mockResolvedValue({
      id: "user-2",
      name: "Julia Rivera",
      email: "julia@example.org",
      role: "VOLUNTEER",
      volunteerProfile: {
        id: "volunteer-1"
      }
    });

    const account = await registerAccount({
      name: "Julia Rivera",
      email: "julia@example.org",
      phone: "5551234567",
      password: "Password1"
    });

    expect(account).toMatchObject({
      id: "user-2",
      role: "VOLUNTEER",
      volunteerProfileId: "volunteer-1"
    });
    expect(mocks.tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: "5551234567",
          role: "VOLUNTEER",
          volunteerProfile: {
            create: {
              active: true,
              preferredAreas: []
            }
          }
        })
      })
    );
  });

  it("rejects duplicate account emails", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      registerAccount({
        name: "Julia Rivera",
        email: "julia@example.org",
        password: "Password1"
      })
    ).rejects.toMatchObject({
      statusCode: 409
    });

    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
