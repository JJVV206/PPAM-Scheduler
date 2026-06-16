import type { AssignmentDetailDto } from "@/types/domain";

export function getVolunteerAssignmentSlot(
  assignment: AssignmentDetailDto,
  volunteerProfileId: string
) {
  return assignment.volunteers.find(
    (volunteer) => volunteer.volunteerId === volunteerProfileId
  );
}

export function isVolunteerAssignmentPendingResponse(
  assignment: AssignmentDetailDto,
  volunteerProfileId: string
) {
  return (
    getVolunteerAssignmentSlot(assignment, volunteerProfileId)
      ?.responseStatus === "PENDING"
  );
}

export function isVolunteerAssignmentConfirmed(
  assignment: AssignmentDetailDto,
  volunteerProfileId: string
) {
  return (
    getVolunteerAssignmentSlot(assignment, volunteerProfileId)
      ?.responseStatus === "CONFIRMED"
  );
}

export function getVolunteerAssignmentRoleLabel(
  assignment: AssignmentDetailDto,
  volunteerProfileId: string
) {
  const slot = getVolunteerAssignmentSlot(assignment, volunteerProfileId);
  const invitation = assignment.invitations.find(
    (item) => item.volunteerId === volunteerProfileId
  );

  return slot?.isReplacement || invitation?.type === "REPLACEMENT"
    ? "Suplente"
    : "Titular";
}
