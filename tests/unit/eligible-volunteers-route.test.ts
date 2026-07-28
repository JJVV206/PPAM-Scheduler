import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getEligiblePrimaryVolunteers: vi.fn(),
  getVolunteerEligibilityContext: vi.fn()
}));

vi.mock("@/lib/auth/guards", () => ({
  requireRole: mocks.requireRole
}));
vi.mock("@/services/volunteer-eligibility.service", () => ({
  getEligiblePrimaryVolunteers: mocks.getEligiblePrimaryVolunteers,
  getVolunteerEligibilityContext: mocks.getVolunteerEligibilityContext
}));

import { GET } from "@/app/api/admin/volunteers/eligible/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({
    session: { user: { id: "admin-1", role: "ADMIN" } }
  });
  mocks.getEligiblePrimaryVolunteers.mockResolvedValue([
    {
      id: "volunteer-1",
      name: "Gerson"
    }
  ]);
  mocks.getVolunteerEligibilityContext.mockReturnValue({
    date: "2026-07-27",
    dayOfWeek: "MONDAY",
    timeSlot: "SLOT_09_11"
  });
});

describe("eligible volunteers route", () => {
  it("returns candidates for an administrator", async () => {
    const response = (await GET(
      new Request(
        "https://ppam.example.org/api/admin/volunteers/eligible?date=2026-07-27&timeSlot=SLOT_09_11&assignmentId=assignment-1"
      )
    ))!;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(mocks.getEligiblePrimaryVolunteers).toHaveBeenCalledWith({
      date: expect.any(Date),
      timeSlot: "SLOT_09_11",
      assignmentId: "assignment-1"
    });
    expect(body.context.dayOfWeek).toBe("MONDAY");
    expect(body.volunteers[0].name).toBe("Gerson");
  });

  it("rejects an invalid calendar date", async () => {
    const response = (await GET(
      new Request(
        "https://ppam.example.org/api/admin/volunteers/eligible?date=2026-02-30&timeSlot=SLOT_09_11"
      )
    ))!;
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("La fecha seleccionada no es válida.");
    expect(mocks.getEligiblePrimaryVolunteers).not.toHaveBeenCalled();
  });

  it("rejects invalid date formats and time slots with bad request", async () => {
    const invalidDateResponse = (await GET(
      new Request(
        "https://ppam.example.org/api/admin/volunteers/eligible?date=27-07-2026&timeSlot=SLOT_09_11"
      )
    ))!;
    const invalidTimeSlotResponse = (await GET(
      new Request(
        "https://ppam.example.org/api/admin/volunteers/eligible?date=2026-07-27&timeSlot=SLOT_INVALID"
      )
    ))!;

    expect(invalidDateResponse.status).toBe(400);
    expect(invalidTimeSlotResponse.status).toBe(400);
    expect(mocks.getEligiblePrimaryVolunteers).not.toHaveBeenCalled();
  });
});
