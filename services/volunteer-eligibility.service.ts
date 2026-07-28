import type { Prisma, PrismaClient, TimeSlot } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { DAY_LABELS, TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { getPpamDateKey, getPpamDayOfWeek } from "@/lib/assignments/time";
import { deriveVolunteerServiceType } from "@/lib/volunteer-service-type";
import { AppError } from "@/services/errors";
import type { VolunteerSummary } from "@/types/domain";

type EligibilityClient = PrismaClient | Prisma.TransactionClient;

type EligibilityInput = {
  client?: EligibilityClient;
  date: Date;
  timeSlot: TimeSlot;
  assignmentId?: string;
  volunteerIds?: string[];
  excludeVolunteerIds?: string[];
};

function mapEligibleVolunteer(record: {
  id: string;
  userId: string;
  transportationNotes: string | null;
  preferredAreas: string[];
  reliabilityScore: number;
  confirmationCount: number;
  declineCount: number;
  noResponseCount: number;
  active: boolean;
  temporaryUnavailable: boolean;
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    active: boolean;
    accessStatus: string;
  };
}): VolunteerSummary {
  return {
    id: record.id,
    userId: record.userId,
    name: record.user.name,
    email: record.user.email,
    phone: record.user.phone,
    active: true,
    transportationNotes: record.transportationNotes,
    preferredAreas: record.preferredAreas,
    reliabilityScore: record.reliabilityScore,
    confirmationCount: record.confirmationCount,
    declineCount: record.declineCount,
    noResponseCount: record.noResponseCount,
    temporaryUnavailable: record.temporaryUnavailable,
    canServeAsPrimary: record.canServeAsPrimary,
    canServeAsReplacement: record.canServeAsReplacement,
    serviceType: deriveVolunteerServiceType(record)
  };
}

function getEligibilityWhere(input: EligibilityInput) {
  const dayOfWeek = getPpamDayOfWeek(input.date);

  return {
    ...(input.volunteerIds
      ? { id: { in: [...new Set(input.volunteerIds)] } }
      : input.excludeVolunteerIds?.length
        ? { id: { notIn: [...new Set(input.excludeVolunteerIds)] } }
        : {}),
    active: true,
    canServeAsPrimary: true,
    temporaryUnavailable: false,
    user: {
      active: true,
      accessStatus: "APPROVED" as const
    },
    availability: {
      some: {
        dayOfWeek,
        timeSlot: input.timeSlot,
        available: true,
        recurring: true
      }
    },
    availabilityBlocks: {
      none: {
        startDate: { lte: input.date },
        endDate: { gte: input.date }
      }
    },
    ...(input.assignmentId
      ? {
          assignments: {
            none: {
              assignment: {
                id: { not: input.assignmentId },
                date: input.date,
                timeSlot: input.timeSlot,
                status: { notIn: ["CANCELLED"] }
              }
            }
          }
        }
      : {})
  } satisfies Prisma.VolunteerProfileWhereInput;
}

export function getVolunteerEligibilityContext(input: {
  date: Date;
  timeSlot: TimeSlot;
}) {
  return {
    date: getPpamDateKey(input.date),
    dayOfWeek: getPpamDayOfWeek(input.date),
    timeSlot: input.timeSlot
  };
}

export async function getEligiblePrimaryVolunteers(input: EligibilityInput) {
  const client = input.client ?? db;
  const volunteers = await client.volunteerProfile.findMany({
    where: getEligibilityWhere(input),
    select: {
      id: true,
      userId: true,
      transportationNotes: true,
      preferredAreas: true,
      reliabilityScore: true,
      confirmationCount: true,
      declineCount: true,
      noResponseCount: true,
      active: true,
      temporaryUnavailable: true,
      canServeAsPrimary: true,
      canServeAsReplacement: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          active: true,
          accessStatus: true
        }
      }
    },
    orderBy: [{ reliabilityScore: "desc" }, { user: { name: "asc" } }]
  });

  return volunteers.map(mapEligibleVolunteer);
}

export async function assertVolunteersEligibleForSlot(input: {
  client?: EligibilityClient;
  date: Date;
  timeSlot: TimeSlot;
  volunteerIds: string[];
  assignmentId?: string;
}) {
  const uniqueVolunteerIds = [...new Set(input.volunteerIds.filter(Boolean))];
  if (!uniqueVolunteerIds.length) return;

  const eligibleVolunteers = await getEligiblePrimaryVolunteers({
    client: input.client,
    date: input.date,
    timeSlot: input.timeSlot,
    assignmentId: input.assignmentId,
    volunteerIds: uniqueVolunteerIds
  });
  const eligibleIds = new Set(
    eligibleVolunteers.map((volunteer) => volunteer.id)
  );
  const invalidIds = uniqueVolunteerIds.filter(
    (volunteerId) => !eligibleIds.has(volunteerId)
  );

  if (!invalidIds.length) return;

  const client = input.client ?? db;
  const invalidVolunteers = await client.volunteerProfile.findMany({
    where: { id: { in: invalidIds } },
    select: { id: true, user: { select: { name: true } } }
  });
  const namesById = new Map(
    invalidVolunteers.map((volunteer) => [volunteer.id, volunteer.user.name])
  );
  const names = invalidIds.map(
    (volunteerId) => namesById.get(volunteerId) ?? "el voluntario seleccionado"
  );
  const dayOfWeek = getPpamDayOfWeek(input.date);
  const dayLabel = DAY_LABELS[dayOfWeek].toLowerCase();
  const timeLabel = TIME_SLOT_DEFINITIONS[input.timeSlot].label;

  throw new AppError(
    "No puedes asignar a " +
      names.join(", ") +
      " porque no indicó disponibilidad para " +
      dayLabel +
      " en " +
      timeLabel +
      ".",
    409
  );
}
