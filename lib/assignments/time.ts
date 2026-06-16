import type { TimeSlot } from "@prisma/client";

import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";

export function buildAssignmentStartDate(input: {
  date: Date;
  timeSlot: TimeSlot;
}) {
  const [hour, minute] = TIME_SLOT_DEFINITIONS[input.timeSlot].start
    .split(":")
    .map(Number);
  const assignmentStart = new Date(input.date);
  assignmentStart.setHours(hour, minute, 0, 0);
  return assignmentStart;
}
