import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    assignmentInvitation: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import { getAssignmentInvitationResponseUrlForAdmin } from "@/services/assignment-invitation.service";

const originalAppBaseUrl = process.env.APP_BASE_URL;

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "invitation-1",
    token: "token 123",
    status: "SENT",
    respondedAt: null,
    expiresAt: new Date("2099-07-08T12:00:00.000Z"),
    volunteer: {
      user: {
        name: "Julia Westbrook"
      }
    },
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_BASE_URL = "https://ppam.example.org";
});

afterEach(() => {
  if (originalAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
    return;
  }

  process.env.APP_BASE_URL = originalAppBaseUrl;
});

describe("assignment invitation response URL", () => {
  it("returns an encoded response URL for active invitations", async () => {
    mocks.db.assignmentInvitation.findUnique.mockResolvedValueOnce(
      invitation()
    );

    const result =
      await getAssignmentInvitationResponseUrlForAdmin("invitation-1");

    expect(mocks.db.assignmentInvitation.findUnique).toHaveBeenCalledWith({
      where: {
        id: "invitation-1"
      },
      include: {
        volunteer: {
          include: {
            user: true
          }
        }
      }
    });
    expect(result).toEqual({
      responseUrl: "https://ppam.example.org/confirm-assignment/token%20123",
      volunteerName: "Julia Westbrook",
      status: "SENT",
      expiresAt: "2099-07-08T12:00:00.000Z"
    });
  });

  it("rejects missing invitations", async () => {
    mocks.db.assignmentInvitation.findUnique.mockResolvedValueOnce(null);

    await expect(
      getAssignmentInvitationResponseUrlForAdmin("missing")
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects responded invitations", async () => {
    mocks.db.assignmentInvitation.findUnique.mockResolvedValueOnce(
      invitation({
        status: "ACCEPTED",
        respondedAt: new Date("2026-07-07T12:00:00.000Z")
      })
    );

    await expect(
      getAssignmentInvitationResponseUrlForAdmin("invitation-1")
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects expired invitations", async () => {
    mocks.db.assignmentInvitation.findUnique.mockResolvedValueOnce(
      invitation({
        expiresAt: new Date("2020-07-08T12:00:00.000Z")
      })
    );

    await expect(
      getAssignmentInvitationResponseUrlForAdmin("invitation-1")
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects failed invitations", async () => {
    mocks.db.assignmentInvitation.findUnique.mockResolvedValueOnce(
      invitation({
        status: "FAILED"
      })
    );

    await expect(
      getAssignmentInvitationResponseUrlForAdmin("invitation-1")
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
