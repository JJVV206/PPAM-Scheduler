import { startOfDay } from "date-fns";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import type { VolunteerSummary } from "@/types/domain";

const TERMINAL_ASSIGNMENT_STATUSES = ["CANCELLED", "COMPLETED"] as const;

export type ReplacementCandidatePriority = {
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
  };
}>;

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

function mapCandidate(
  volunteer: VolunteerCandidateRecord,
  input: {
    area: string;
    attemptedVolunteerIds: Set<string>;
  }
): ReplacementCandidateDto {
  const active = volunteer.active && volunteer.user.active;
  const exactAvailability = volunteer.availability.some((item) => item.available);
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
    replacementPriority: {
      exactAvailability,
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
      Number(rightPriority.exactAvailability) -
        Number(leftPriority.exactAvailability) ||
      Number(rightPriority.markedAsReplacement) -
        Number(leftPriority.markedAsReplacement) ||
      Number(rightPriority.areaCompatible) -
        Number(leftPriority.areaCompatible) ||
      rightPriority.confirmationRate - leftPriority.confirmationRate ||
      rightPriority.reliabilityScore - leftPriority.reliabilityScore ||
      leftPriority.futureAssignmentCount - rightPriority.futureAssignmentCount ||
      left.name.localeCompare(right.name, "es-MX")
    );
  });
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
      availability: {
        some: {
          dayOfWeek: assignment.dayOfWeek,
          timeSlot: assignment.timeSlot,
          available: true
        }
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
          timeSlot: assignment.timeSlot,
          available: true
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

  const candidates = rankReplacementCandidates(
    volunteers.map((volunteer) =>
      mapCandidate(volunteer, {
        area: assignment.preachingPoint.area,
        attemptedVolunteerIds
      })
    )
  );

  return typeof input.take === "number"
    ? candidates.slice(0, input.take)
    : candidates;
}

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
    temporaryUnavailable: candidate.temporaryUnavailable
  };
}
