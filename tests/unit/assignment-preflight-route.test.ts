import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getSameDayVolunteerRepeatWarnings: vi.fn()
}));

vi.mock("@/lib/auth/guards", () => ({
  requireRole: mocks.requireRole
}));
vi.mock("@/services/assignment.service", () => ({
  getSameDayVolunteerRepeatWarnings: mocks.getSameDayVolunteerRepeatWarnings
}));

import { POST } from "@/app/api/assignments/preflight/route";

function preflightRequest(body: Record<string, unknown>) {
  return new Request("https://ppam.example.org/api/assignments/preflight", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

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
  mocks.getSameDayVolunteerRepeatWarnings.mockResolvedValue({
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

describe("assignment preflight route", () => {
  it("returns same-day repeat warnings for selected volunteers", async () => {
    const response = (await POST(
      preflightRequest({
        assignmentId: "assignment-current",
        date: "2026-07-20T12:00:00.000Z",
        timeSlot: "SLOT_07_09",
        volunteerIds: ["volunteer-1", "volunteer-2"]
      })
    ))!;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(mocks.getSameDayVolunteerRepeatWarnings).toHaveBeenCalledWith({
      assignmentId: "assignment-current",
      date: expect.any(Date),
      timeSlot: "SLOT_07_09",
      volunteerIds: ["volunteer-1", "volunteer-2"]
    });
    expect(body.repeatedVolunteerIds).toEqual(["volunteer-1"]);
    expect(body.warnings[0]).toContain("Julia Westbrook");
  });
});
