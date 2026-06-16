import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    db: {
      assignment: {
        findMany: vi.fn()
      }
    },
    createPendingPrimaryInvitationsForAssignment: vi.fn(),
    openReplacementCensusForWeek: vi.fn(),
    sendPendingPrimaryInvitationsForAssignment: vi.fn(),
    sendPendingReplacementCensusInvitations: vi.fn()
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/services/assignment-invitation.service", () => ({
  createPendingPrimaryInvitationsForAssignment:
    mocks.createPendingPrimaryInvitationsForAssignment,
  sendPendingPrimaryInvitationsForAssignment:
    mocks.sendPendingPrimaryInvitationsForAssignment
}));
vi.mock("@/services/replacement-census.service", () => ({
  openReplacementCensusForWeek: mocks.openReplacementCensusForWeek,
  sendPendingReplacementCensusInvitations:
    mocks.sendPendingReplacementCensusInvitations
}));

import { prepareScheduleWeekAutomation } from "@/services/schedule-week-preparation.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.assignment.findMany.mockResolvedValue([
    {
      id: "assignment-1",
      volunteers: [
        { volunteerId: "volunteer-1", isReplacement: false },
        { volunteerId: "volunteer-2", isReplacement: false }
      ]
    },
    {
      id: "assignment-2",
      volunteers: [
        { volunteerId: "replacement-1", isReplacement: true },
        { volunteerId: "volunteer-3", isReplacement: false }
      ]
    }
  ]);
  mocks.createPendingPrimaryInvitationsForAssignment
    .mockResolvedValueOnce({
      createdCount: 2,
      skippedCount: 0
    })
    .mockResolvedValueOnce({
      createdCount: 1,
      skippedCount: 0
    });
  mocks.sendPendingPrimaryInvitationsForAssignment
    .mockResolvedValueOnce({
      sentCount: 2,
      failedCount: 0
    })
    .mockResolvedValueOnce({
      sentCount: 1,
      failedCount: 0
    });
  mocks.openReplacementCensusForWeek.mockResolvedValue({
    census: {
      id: "census-1"
    },
    replacementCount: 3,
    createdResponseCount: 3,
    skippedResponseCount: 0
  });
  mocks.sendPendingReplacementCensusInvitations.mockResolvedValue({
    sentCount: 3,
    failedCount: 0
  });
});

describe("schedule week preparation", () => {
  it("prepares primary invitations and replacement census for a week", async () => {
    const result = await prepareScheduleWeekAutomation({
      scheduleWeekId: "week-1",
      actorUserId: "admin-1"
    });

    expect(mocks.createPendingPrimaryInvitationsForAssignment).toHaveBeenNthCalledWith(
      1,
      {
        assignmentId: "assignment-1",
        volunteerIds: ["volunteer-1", "volunteer-2"],
        actorUserId: "admin-1",
        source: "week_preparation",
        metadata: {
          scheduleWeekId: "week-1"
        }
      }
    );
    expect(mocks.createPendingPrimaryInvitationsForAssignment).toHaveBeenNthCalledWith(
      2,
      {
        assignmentId: "assignment-2",
        volunteerIds: ["volunteer-3"],
        actorUserId: "admin-1",
        source: "week_preparation",
        metadata: {
          scheduleWeekId: "week-1"
        }
      }
    );
    expect(mocks.openReplacementCensusForWeek).toHaveBeenCalledWith({
      scheduleWeekId: "week-1",
      actorUserId: "admin-1"
    });
    expect(mocks.sendPendingReplacementCensusInvitations).toHaveBeenCalledWith({
      censusId: "census-1"
    });
    expect(result).toEqual({
      scheduleWeekId: "week-1",
      assignmentCount: 2,
      primaryInvitations: {
        createdCount: 3,
        skippedCount: 0,
        sentCount: 3,
        failedCount: 0
      },
      replacementCensus: {
        censusId: "census-1",
        replacementCount: 3,
        createdResponseCount: 3,
        skippedResponseCount: 0,
        sentCount: 3,
        failedCount: 0
      }
    });
  });
});
