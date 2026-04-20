import { db } from "@/lib/db/prisma";
import type { ReportSummaryDto } from "@/types/domain";
import { safePercentage } from "@/lib/utils";

export async function getReportSummary(): Promise<ReportSummaryDto> {
  const [assignments, points, volunteerParticipation] = await Promise.all([
    db.assignment.findMany({
      include: {
        volunteers: {
          include: {
            volunteer: {
              include: { user: true }
            }
          }
        }
      }
    }),
    db.preachingPoint.findMany({
      include: { assignments: true }
    }),
    db.assignmentVolunteer.groupBy({
      by: ["volunteerId"],
      _count: {
        volunteerId: true
      }
    })
  ]);

  const totalAssignments = assignments.length;
  const confirmedAssignments = assignments.filter(
    (assignment) => assignment.status === "CONFIRMED"
  ).length;
  const declinedAssignments = assignments.filter(
    (assignment) => assignment.status === "DECLINED"
  ).length;
  const openSlots = assignments.filter(
    (assignment) =>
      assignment.status === "NEEDS_REPLACEMENT" || assignment.volunteers.length < 2
  ).length;
  const coveredPoints = points.filter((point) => point.assignments.length > 0).length;

  const names = await db.volunteerProfile.findMany({
    where: {
      id: {
        in: volunteerParticipation.map((entry) => entry.volunteerId)
      }
    },
    include: { user: true }
  });

  return {
    totalAssignments,
    confirmationRate: safePercentage(confirmedAssignments, totalAssignments),
    declineRate: safePercentage(declinedAssignments, totalAssignments),
    openSlotRate: safePercentage(openSlots, totalAssignments),
    pointCoverageRate: safePercentage(coveredPoints, points.length),
    volunteerParticipation: volunteerParticipation
      .map((entry) => ({
        volunteerName:
          names.find((name) => name.id === entry.volunteerId)?.user.name ?? "Unknown",
        count: entry._count.volunteerId
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  };
}
