import { startOfDay } from "date-fns";
import { Prisma } from "@prisma/client";
import type { TimeSlot } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import type { VolunteerSummary } from "@/types/domain";

const TERMINAL_ASSIGNMENT_STATUSES = ["CANCELLED", "COMPLETED"] as const;

export type ReplacementAvailabilitySource =
  | "WEEKLY_EXACT"
  | "WEEKLY_DAY"
  | "RECURRING_EXACT"
  | "UNCONFIRMED"
  | "UNAVAILABLE";

export type ReplacementCandidatePriority = {
  availabilitySource: ReplacementAvailabilitySource;
  availabilityRank: number;
  weeklyExactAvailability: boolean;
  weeklyDayAvailability: boolean;
  recurringAvailability: boolean;
  exactAvailability: boolean;
  markedAsReplacement: boolean;
  areaCompatible: boolean;
  confirmationRate: number;
  reliabilityScore: number;
  futureAssignmentCount: number;
  attemptedBefore: boolean;
};

export type ReplacementCandidateDto = VolunteerSummary & {
  replacementPriority: ReplacementCandidatePriority;
};

type ReplacementCandidateRankingInput = {
  name: string;
  replacementPriority: ReplacementCandidatePriority;
};

type VolunteerCandidateRecord = Prisma.VolunteerProfileGetPayload<{
  include: {
    user: true;
    availability: true;
    assignments: true;
    weeklyAvailability: true;
  };
}>;

type AvailabilityRecord = {
  timeSlot: TimeSlot | null;
  available: boolean;
};

type RecurringAvailabilityRecord = {
  timeSlot: TimeSlot;
  available: boolean;
  recurring: boolean;
};

function calculateConfirmationRate(input: {
  confirmationCount: number;
  declineCount: number;
  noResponseCount: number;
  reliabilityScore: number;
}) {
  const total =
    input.confirmationCount + input.declineCount + input.noResponseCount;

  if (total <= 0) {
    return input.reliabilityScore / 100;
  }

  return input.confirmationCount / total;
}

function isAreaCompatible(input: {
  preferredAreas: string[];
  availability: Array<{ areaPreference: string | null }>;
  area: string;
}) {
  return (
    input.preferredAreas.includes(input.area) ||
    input.availability.some((item) => item.areaPreference === input.area)
  );
}

export function getReplacementAvailabilityMatch(input: {
  weeklyAvailability: readonly AvailabilityRecord[];
  recurringAvailability: readonly RecurringAvailabilityRecord[];
  timeSlot: TimeSlot;
}): {
  source: ReplacementAvailabilitySource;
  rank: number;
  unavailable: boolean;
} {
  const explicitlyUnavailable = input.weeklyAvailability.some(
    (item) =>
      !item.available &&
      (item.timeSlot === null || item.timeSlot === input.timeSlot)
  );

  if (explicitlyUnavailable) {
    return {
      source: "UNAVAILABLE",
      rank: -1,
      unavailable: true
    };
  }

  const weeklyExact = input.weeklyAvailability.some(
    (item) => item.available && item.timeSlot === input.timeSlot
  );

  if (weeklyExact) {
    return {
      source: "WEEKLY_EXACT",
      rank: 3,
      unavailable: false
    };
  }

  const weeklyDay = input.weeklyAvailability.some(
    (item) => item.available && item.timeSlot === null
  );

  if (weeklyDay) {
    return {
      source: "WEEKLY_DAY",
      rank: 2,
      unavailable: false
    };
  }

  const recurringExact = input.recurringAvailability.some(
    (item) =>
      item.available && item.recurring && item.timeSlot === input.timeSlot
  );

  if (recurringExact) {
    return {
      source: "RECURRING_EXACT",
      rank: 1,
      unavailable: false
    };
  }

  return {
    source: "UNCONFIRMED",
    rank: 0,
    unavailable: false
  };
}

function mapCandidate(
  volunteer: VolunteerCandidateRecord,
  input: {
    area: string;
    attemptedVolunteerIds: Set<string>;
    timeSlot: TimeSlot;
  }
): ReplacementCandidateDto {
  const active = volunteer.active && volunteer.user.active;
  const availabilityMatch = getReplacementAvailabilityMatch({
    weeklyAvailability: volunteer.weeklyAvailability,
    recurringAvailability: volunteer.availability,
    timeSlot: input.timeSlot
  });
  const areaCompatible = isAreaCompatible({
    preferredAreas: volunteer.preferredAreas,
    availability: volunteer.availability,
    area: input.area
  });

  return {
    id: volunteer.id,
    userId: volunteer.userId,
    name: volunteer.user.name,
    email: volunteer.user.email,
    phone: volunteer.user.phone,
    active,
    transportationNotes: volunteer.transportationNotes,
    preferredAreas: volunteer.preferredAreas,
    reliabilityScore: volunteer.reliabilityScore,
    confirmationCount: volunteer.confirmationCount,
    declineCount: volunteer.declineCount,
    noResponseCount: volunteer.noResponseCount,
    temporaryUnavailable: volunteer.temporaryUnavailable,
    canServeAsReplacement: volunteer.canServeAsReplacement,
    replacementPriority: {
      availabilitySource: availabilityMatch.source,
      availabilityRank: availabilityMatch.rank,
      weeklyExactAvailability: availabilityMatch.source === "WEEKLY_EXACT",
      weeklyDayAvailability: availabilityMatch.source === "WEEKLY_DAY",
      recurringAvailability: availabilityMatch.source === "RECURRING_EXACT",
      exactAvailability:
        availabilityMatch.source === "WEEKLY_EXACT" ||
        availabilityMatch.source === "RECURRING_EXACT",
      markedAsReplacement: volunteer.canServeAsReplacement,
      areaCompatible,
      confirmationRate: calculateConfirmationRate(volunteer),
      reliabilityScore: volunteer.reliabilityScore,
      futureAssignmentCount: volunteer.assignments.length,
      attemptedBefore: input.attemptedVolunteerIds.has(volunteer.id)
    }
  };
}

export function rankReplacementCandidates<T extends ReplacementCandidateRankingInput>(
  candidates: T[]
) {
  return [...candidates].sort((left, right) => {
    const leftPriority = left.replacementPriority;
    const rightPriority = right.replacementPriority;

    return (
      rightPriority.availabilityRank - leftPriority.availabilityRank ||
      Number(rightPriority.areaCompatible) -
        Number(leftPriority.areaCompatible) ||
      rightPriority.confirmationRate - leftPriority.confirmationRate ||
      rightPriority.reliabilityScore - leftPriority.reliabilityScore ||
      leftPriority.futureAssignmentCount - rightPriority.futureAssignmentCount ||
      left.name.localeCompare(right.name, "es-MX")
    );
  });
}

export function excludeAlreadyAttemptedCandidates<T extends { id: string }>(
  candidates: T[],
  attemptedVolunteerIds: Set<string>
) {
  return candidates.filter((candidate) => !attemptedVolunteerIds.has(candidate.id));
}

export async function getReplacementCandidatesForAssignment(input: {
  assignmentId: string;
  take?: number;
}) {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: {
      id: input.assignmentId
    },
    include: {
      preachingPoint: true,
      volunteers: true,
      responses: true,
      invitations: {
        select: {
          volunteerId: true,
          type: true
        }
      }
    }
  });

  const assignedVolunteerIds = assignment.volunteers.map(
    (volunteer) => volunteer.volunteerId
  );
  const declinedVolunteerIds = assignment.responses
    .filter((response) => response.responseStatus === "DECLINED")
    .map((response) => response.volunteerId);
  const attemptedVolunteerIds = new Set(
    assignment.invitations
      .filter((invitation) => invitation.type === "REPLACEMENT")
      .map((invitation) => invitation.volunteerId)
  );
  const excludedVolunteerIds = [
    ...new Set([
      ...assignedVolunteerIds,
      ...declinedVolunteerIds,
      ...attemptedVolunteerIds
    ])
  ];

  const volunteers = await db.volunteerProfile.findMany({
    where: {
      active: true,
      canServeAsReplacement: true,
      temporaryUnavailable: false,
      user: {
        active: true
      },
      id: {
        notIn: excludedVolunteerIds
      },
      availabilityBlocks: {
        none: {
          startDate: {
            lte: assignment.date
          },
          endDate: {
            gte: assignment.date
          }
        }
      },
      assignments: {
        none: {
          assignment: {
            date: assignment.date,
            timeSlot: assignment.timeSlot,
            status: {
              notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
            }
          }
        }
      }
    },
    include: {
      user: true,
      availability: {
        where: {
          dayOfWeek: assignment.dayOfWeek,
          available: true
        }
      },
      weeklyAvailability: {
        where: {
          scheduleWeekId: assignment.scheduleWeekId,
          date: assignment.date,
          OR: [
            {
              timeSlot: assignment.timeSlot
            },
            {
              timeSlot: null
            }
          ]
        }
      },
      assignments: {
        where: {
          assignment: {
            date: {
              gte: startOfDay(new Date())
            },
            status: {
              notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
            }
          }
        }
      }
    }
  });

  const eligibleCandidates = volunteers
    .map((volunteer) =>
      mapCandidate(volunteer, {
        area: assignment.preachingPoint.area,
        attemptedVolunteerIds,
        timeSlot: assignment.timeSlot
      })
    )
    .filter(
      (candidate) =>
        candidate.replacementPriority.availabilitySource !== "UNAVAILABLE"
    );
  const candidates = rankReplacementCandidates(
    excludeAlreadyAttemptedCandidates(eligibleCandidates, attemptedVolunteerIds)
  );

  return typeof input.take === "number"
    ? candidates.slice(0, input.take)
    : candidates;
}

export const findReplacementCandidatesForAssignment =
  getReplacementCandidatesForAssignment;

export async function selectNextReplacementCandidateForAssignment(
  assignmentId: string
) {
  const [candidate] = await getReplacementCandidatesForAssignment({
    assignmentId,
    take: 1
  });

  return candidate ?? null;
}

export function toVolunteerSummary(
  candidate: ReplacementCandidateDto
): VolunteerSummary {
  return {
    id: candidate.id,
    userId: candidate.userId,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    active: candidate.active,
    transportationNotes: candidate.transportationNotes,
    preferredAreas: candidate.preferredAreas,
    reliabilityScore: candidate.reliabilityScore,
    confirmationCount: candidate.confirmationCount,
    declineCount: candidate.declineCount,
    noResponseCount: candidate.noResponseCount,
    temporaryUnavailable: candidate.temporaryUnavailable,
    canServeAsReplacement: candidate.canServeAsReplacement
  };
}
