import { db } from "@/lib/db/prisma";
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";
import { AppError } from "@/services/errors";

function withFixedPointName<T extends { name: string }>(point: T): T {
  return {
    ...point,
    name: FIXED_PREACHING_POINT_NAME
  };
}

export async function getSingletonPreachingPoint() {
  const point =
    (await db.preachingPoint.findFirst({
      where: { name: FIXED_PREACHING_POINT_NAME },
      include: {
        activeSlots: true
      }
    })) ??
    (await db.preachingPoint.findFirst({
      include: {
        activeSlots: true
      },
      orderBy: [{ active: "desc" }, { name: "asc" }]
    }));

  if (!point) {
    throw new AppError("No hay un punto de predicación configurado.", 500);
  }

  return withFixedPointName(point);
}

export async function getPreachingPoints() {
  return [await getSingletonPreachingPoint()];
}

export async function getPreachingPoint(pointId: string) {
  const point = await db.preachingPoint.findUniqueOrThrow({
    where: { id: pointId },
    include: {
      activeSlots: true,
      assignments: {
        orderBy: { date: "desc" },
        take: 20
      }
    }
  });

  return withFixedPointName(point);
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
  void input;
  throw new AppError(
    "Esta instalación usa un único punto fijo de predicación y no permite crear otros.",
    403
  );
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
  void pointId;
  void input;
  throw new AppError(
    "El punto de predicación está fijado y no puede editarse desde esta instalación.",
    403
  );
}

export async function deletePreachingPoint(pointId: string) {
  void pointId;
  throw new AppError(
    "El punto de predicación fijo no puede eliminarse.",
    403
  );
}
