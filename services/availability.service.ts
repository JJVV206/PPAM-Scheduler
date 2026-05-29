import { db } from "@/lib/db/prisma";
import type { DayOfWeek, TimeSlot } from "@/types/domain";

export async function updateVolunteerAvailability(input: {
  volunteerId: string;
  items: Array<{
    dayOfWeek: DayOfWeek;
    timeSlot: TimeSlot;
    areaPreference?: string;
    available: boolean;
    recurring: boolean;
  }>;
  temporaryUnavailable: boolean;
  exceptions?: Array<{
    startDate: Date;
    endDate: Date;
    reason?: string;
  }>;
}) {
  await db.$transaction(async (tx) => {
    await tx.volunteerAvailability.deleteMany({
      where: { volunteerId: input.volunteerId }
    });

    if (input.items.length) {
      await tx.volunteerAvailability.createMany({
        data: input.items.map((item) => ({
          volunteerId: input.volunteerId,
          dayOfWeek: item.dayOfWeek,
          timeSlot: item.timeSlot,
          areaPreference: item.areaPreference,
          available: item.available,
          recurring: item.recurring
        }))
      });
    }

    await tx.availabilityException.deleteMany({
      where: { volunteerId: input.volunteerId }
    });

    if (input.exceptions?.length) {
      await tx.availabilityException.createMany({
        data: input.exceptions.map((exception) => ({
          volunteerId: input.volunteerId,
          startDate: exception.startDate,
          endDate: exception.endDate,
          reason: exception.reason
        }))
      });
    }

    await tx.volunteerProfile.update({
      where: { id: input.volunteerId },
      data: {
        temporaryUnavailable: input.temporaryUnavailable
      }
    });
  });

  return db.volunteerProfile.findUniqueOrThrow({
    where: { id: input.volunteerId },
    include: {
      availability: true,
      availabilityBlocks: true
    }
  });
}
