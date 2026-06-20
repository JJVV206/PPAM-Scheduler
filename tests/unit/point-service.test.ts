import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    preachingPoint: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";
import {
  getPreachingPoint,
  getSingletonPreachingPoint
} from "@/services/point.service";

const legacyActiveSlots = [
  {
    id: "legacy-slot-1",
    preachingPointId: "point-1",
    dayOfWeek: "TUESDAY",
    timeSlot: "SLOT_09_11"
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("point service", () => {
  it("normalizes the fixed preaching point as unrestricted for scheduling", async () => {
    mocks.db.preachingPoint.findFirst.mockResolvedValueOnce({
      id: "point-1",
      name: FIXED_PREACHING_POINT_NAME,
      area: "Hospital",
      notes: null,
      active: true,
      activeSlots: legacyActiveSlots
    });

    const point = await getSingletonPreachingPoint();

    expect(point.name).toBe(FIXED_PREACHING_POINT_NAME);
    expect(point.activeSlots).toEqual([]);
  });

  it("normalizes direct fixed point reads as unrestricted for scheduling", async () => {
    mocks.db.preachingPoint.findUniqueOrThrow.mockResolvedValueOnce({
      id: "point-1",
      name: "Legacy point name",
      area: "Hospital",
      notes: null,
      active: true,
      activeSlots: legacyActiveSlots,
      assignments: []
    });

    const point = await getPreachingPoint("point-1");

    expect(point.name).toBe(FIXED_PREACHING_POINT_NAME);
    expect(point.activeSlots).toEqual([]);
  });
});
