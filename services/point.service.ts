import { db } from "@/lib/db/prisma";

export async function getPreachingPoints() {
  return db.preachingPoint.findMany({
    include: {
      activeSlots: true
    },
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });
}

export async function getPreachingPoint(pointId: string) {
  return db.preachingPoint.findUniqueOrThrow({
    where: { id: pointId },
    include: {
      activeSlots: true,
      assignments: {
        orderBy: { date: "desc" },
        take: 20
      }
    }
  });
}

export async function createPreachingPoint(input: {
  name: string;
  area: string;
  notes?: string;
  active: boolean;
  activeSlots: Array<{
    dayOfWeek: import("@/types/domain").DayOfWeek;
    timeSlot: import("@/types/domain").TimeSlot;
  }>;
}) {
  return db.preachingPoint.create({
    data: {
      name: input.name,
      area: input.area,
      notes: input.notes,
      active: input.active,
      activeSlots: {
        createMany: {
          data: input.activeSlots
        }
      }
    },
    include: { activeSlots: true }
  });
}

export async function updatePreachingPoint(
  pointId: string,
  input: {
    name?: string;
    area?: string;
    notes?: string;
    active?: boolean;
    activeSlots?: Array<{
      dayOfWeek: import("@/types/domain").DayOfWeek;
      timeSlot: import("@/types/domain").TimeSlot;
    }>;
  }
) {
  return db.$transaction(async (tx) => {
    if (input.activeSlots) {
      await tx.preachingPointActiveSlot.deleteMany({
        where: { preachingPointId: pointId }
      });
    }

    const point = await tx.preachingPoint.update({
      where: { id: pointId },
      data: {
        name: input.name,
        area: input.area,
        notes: input.notes,
        active: input.active,
        activeSlots: input.activeSlots
          ? {
              createMany: {
                data: input.activeSlots
              }
            }
          : undefined
      },
      include: { activeSlots: true }
    });

    return point;
  });
}

export async function deletePreachingPoint(pointId: string) {
  return db.preachingPoint.delete({
    where: { id: pointId }
  });
}
