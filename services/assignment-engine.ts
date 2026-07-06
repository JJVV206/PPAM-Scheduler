import { differenceInCalendarDays } from "date-fns";

import type { AssignmentStatus, ResponseStatus } from "@/types/domain";

export function determineAssignmentStatus(args: {
  assignmentDate: Date;
  volunteerCount: number;
  responses: Array<{ responseStatus: ResponseStatus }>;
  confirmationLeadDays: number;
  now?: Date;
}): AssignmentStatus {
  const today = args.now ?? new Date();
  const daysUntilAssignment = differenceInCalendarDays(
    args.assignmentDate,
    today
  );
  const hasDeclined = args.responses.some(
    (response) => response.responseStatus === "DECLINED"
  );
  const confirmedCount = args.responses.filter(
    (response) => response.responseStatus === "CONFIRMED"
  ).length;

  if (args.volunteerCount < 2 || hasDeclined) {
    return "NEEDS_REPLACEMENT";
  }

  if (confirmedCount >= args.volunteerCount) {
    return "CONFIRMED";
  }

  if (daysUntilAssignment <= args.confirmationLeadDays) {
    return "PENDING_CONFIRMATION";
  }

  return "SCHEDULED";
}
