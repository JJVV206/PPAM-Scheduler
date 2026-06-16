import { db } from "@/lib/db/prisma";
import {
  createPendingPrimaryInvitationsForAssignment,
  sendPendingPrimaryInvitationsForAssignment
} from "@/services/assignment-invitation.service";
import {
  openReplacementCensusForWeek,
  sendPendingReplacementCensusInvitations
} from "@/services/replacement-census.service";

export type PrepareScheduleWeekAutomationResult = {
  scheduleWeekId: string;
  assignmentCount: number;
  primaryInvitations: {
    createdCount: number;
    skippedCount: number;
    sentCount: number;
    failedCount: number;
  };
  replacementCensus: {
    censusId: string;
    replacementCount: number;
    createdResponseCount: number;
    skippedResponseCount: number;
    sentCount: number;
    failedCount: number;
  };
};

export async function prepareScheduleWeekAutomation(input: {
  scheduleWeekId: string;
  actorUserId: string;
  sendEmails?: boolean;
}): Promise<PrepareScheduleWeekAutomationResult> {
  const sendEmails = input.sendEmails ?? true;
  const assignments = await db.assignment.findMany({
    where: {
      scheduleWeekId: input.scheduleWeekId,
      status: {
        notIn: ["CANCELLED", "COMPLETED"]
      }
    },
    include: {
      volunteers: true
    },
    orderBy: [
      {
        date: "asc"
      },
      {
        timeSlot: "asc"
      },
      {
        pairNumber: "asc"
      }
    ]
  });
  let createdCount = 0;
  let skippedCount = 0;
  let sentCount = 0;
  let failedCount = 0;

  for (const assignment of assignments) {
    const titularVolunteerIds = assignment.volunteers
      .filter((volunteer) => !volunteer.isReplacement)
      .map((volunteer) => volunteer.volunteerId);

    const creation = await createPendingPrimaryInvitationsForAssignment({
      assignmentId: assignment.id,
      volunteerIds: titularVolunteerIds,
      actorUserId: input.actorUserId,
      source: "week_preparation",
      metadata: {
        scheduleWeekId: input.scheduleWeekId
      }
    });
    createdCount += creation.createdCount;
    skippedCount += creation.skippedCount;

    if (!sendEmails) {
      continue;
    }

    const delivery = await sendPendingPrimaryInvitationsForAssignment({
      assignmentId: assignment.id,
      actorUserId: input.actorUserId
    });
    sentCount += delivery.sentCount;
    failedCount += delivery.failedCount;
  }

  const census = await openReplacementCensusForWeek({
    scheduleWeekId: input.scheduleWeekId,
    actorUserId: input.actorUserId
  });
  const censusDelivery = sendEmails
    ? await sendPendingReplacementCensusInvitations({
        censusId: census.census.id
      })
    : {
        sentCount: 0,
        failedCount: 0
      };

  return {
    scheduleWeekId: input.scheduleWeekId,
    assignmentCount: assignments.length,
    primaryInvitations: {
      createdCount,
      skippedCount,
      sentCount,
      failedCount
    },
    replacementCensus: {
      censusId: census.census.id,
      replacementCount: census.replacementCount,
      createdResponseCount: census.createdResponseCount,
      skippedResponseCount: census.skippedResponseCount,
      sentCount: censusDelivery.sentCount,
      failedCount: censusDelivery.failedCount
    }
  };
}
