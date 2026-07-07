import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getAssignmentInvitationResponseUrlForAdmin: vi.fn()
}));

vi.mock("@/lib/auth/guards", () => ({
  requireRole: mocks.requireRole
}));
vi.mock("@/services/assignment-invitation.service", () => ({
  getAssignmentInvitationResponseUrlForAdmin:
    mocks.getAssignmentInvitationResponseUrlForAdmin
}));

import { GET } from "@/app/api/admin/assignment-invitations/[id]/response-url/route";

const request = new Request(
  "https://ppam.example.org/api/admin/assignment-invitations/invitation-1/response-url"
);
const context = {
  params: Promise.resolve({ id: "invitation-1" })
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({
    session: {
      user: {
        id: "admin-1",
        role: "ADMIN"
      }
    }
  });
  mocks.getAssignmentInvitationResponseUrlForAdmin.mockResolvedValue({
    responseUrl: "https://ppam.example.org/confirm-assignment/token",
    volunteerName: "Julia Westbrook",
    status: "SENT",
    expiresAt: "2026-07-08T12:00:00.000Z"
  });
});

describe("assignment invitation response URL route", () => {
  it("requires admin access and returns the response URL", async () => {
    const response = (await GET(request, context))!;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(
      mocks.getAssignmentInvitationResponseUrlForAdmin
    ).toHaveBeenCalledWith("invitation-1");
    expect(body.responseUrl).toBe(
      "https://ppam.example.org/confirm-assignment/token"
    );
  });

  it("rejects non-admin users", async () => {
    mocks.requireRole.mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json"
        }
      })
    });

    const response = (await GET(request, context))!;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(
      mocks.getAssignmentInvitationResponseUrlForAdmin
    ).not.toHaveBeenCalled();
  });
});
