import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    volunteerProfile: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import {
  getPpamDateKey,
  getPpamDayOfWeek,
  parsePpamDateOnly
} from "@/lib/assignments/time";
import {
  assertVolunteersEligibleForSlot,
  getEligiblePrimaryVolunteers
} from "@/services/volunteer-eligibility.service";

const eligibleRecord = {
  id: "volunteer-1",
  userId: "user-1",
  transportationNotes: null,
  preferredAreas: [],
  reliabilityScore: 80,
  confirmationCount: 3,
  declineCount: 0,
  noResponseCount: 0,
  active: true,
  temporaryUnavailable: false,
  canServeAsPrimary: true,
  canServeAsReplacement: true,
  user: {
    id: "user-1",
    name: "Gerson",
    email: "gerson@example.org",
    phone: "555-0100",
    active: true,
    accessStatus: "APPROVED"
  }
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("volunteer eligibility", () => {
  it("derives the PPAM day from the official timezone", () => {
    expect(getPpamDayOfWeek(new Date("2026-07-27T05:30:00.000Z"))).toBe(
      "SUNDAY"
    );
    expect(getPpamDayOfWeek(new Date("2026-07-27T06:30:00.000Z"))).toBe(
      "MONDAY"
    );
    expect(getPpamDateKey(new Date("2026-07-27T06:30:00.000Z"))).toBe(
      "2026-07-27"
    );
    expect(parsePpamDateOnly("2026-02-30")).toBeNull();
  });

  it("queries only approved primary volunteers with exact recurring availability", async () => {
    mocks.db.volunteerProfile.findMany.mockResolvedValue([eligibleRecord]);

    const result = await getEligiblePrimaryVolunteers({
      date: new Date("2026-07-27T12:00:00.000Z"),
      timeSlot: "SLOT_09_11"
    });

    expect(result[0]?.name).toBe("Gerson");
    expect(mocks.db.volunteerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          canServeAsPrimary: true,
          temporaryUnavailable: false,
          user: {
            active: true,
            accessStatus: "APPROVED"
          },
          availability: {
            some: {
              dayOfWeek: "MONDAY",
              timeSlot: "SLOT_09_11",
              available: true,
              recurring: true
            }
          },
          availabilityBlocks: {
            none: {
              startDate: { lte: expect.any(Date) },
              endDate: { gte: expect.any(Date) }
            }
          }
        }),
        orderBy: [{ reliabilityScore: "desc" }, { user: { name: "asc" } }]
      })
    );
  });

  it("excludes conflicts with other assignments while editing the current one", async () => {
    mocks.db.volunteerProfile.findMany.mockResolvedValue([]);

    await getEligiblePrimaryVolunteers({
      date: new Date("2026-07-27T12:00:00.000Z"),
      timeSlot: "SLOT_09_11",
      assignmentId: "assignment-current"
    });

    expect(mocks.db.volunteerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignments: {
            none: {
              assignment: expect.objectContaining({
                id: { not: "assignment-current" },
                date: expect.any(Date),
                timeSlot: "SLOT_09_11",
                status: { notIn: ["CANCELLED"] }
              })
            }
          }
        })
      })
    );
  });

  it("rejects a volunteer that is not eligible with a conflict response", async () => {
    mocks.db.volunteerProfile.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "volunteer-1",
          user: { name: "Gerson" }
        }
      ]);

    await expect(
      assertVolunteersEligibleForSlot({
        date: new Date("2026-07-27T12:00:00.000Z"),
        timeSlot: "SLOT_09_11",
        volunteerIds: ["volunteer-1"]
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "No puedes asignar a Gerson porque no indicó disponibilidad para lunes en 09:00 - 11:00."
    });
  });

  it("accepts a volunteer that meets every eligibility condition", async () => {
    mocks.db.volunteerProfile.findMany.mockResolvedValue([eligibleRecord]);

    await expect(
      assertVolunteersEligibleForSlot({
        date: new Date("2026-07-27T12:00:00.000Z"),
        timeSlot: "SLOT_09_11",
        volunteerIds: ["volunteer-1"]
      })
    ).resolves.toBeUndefined();
  });
});
