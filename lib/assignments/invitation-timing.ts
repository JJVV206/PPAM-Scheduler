import { addHours } from "date-fns";
import type { TimeSlot } from "@prisma/client";

import {
  DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS,
  DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_PRIMARY_REMINDER_OFFSETS_HOURS,
  DEFAULT_URGENT_PRIMARY_RESPONSE_TIMEOUT_HOURS,
  DEFAULT_URGENT_THRESHOLD_HOURS
} from "@/lib/constants/app";
import { buildAssignmentStartDate } from "@/lib/assignments/time";

const MS_PER_HOUR = 60 * 60 * 1000;

export type PrimaryInvitationTimingSettings = {
  primaryResponseTimeoutHours?: number | null;
  primaryReminderOffsetsHours?: readonly number[] | null;
  urgentPrimaryResponseTimeoutHours?: number | null;
  urgentPrimaryReminderOffsetsHours?: readonly number[] | null;
  urgentThresholdHours?: number | null;
};

export function normalizePositiveHourSetting(
  value: number | null | undefined,
  fallback: number
) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export function normalizeReminderOffsetsHours(
  offsets: readonly number[] | null | undefined,
  fallback: readonly number[]
) {
  const normalized = [...new Set(offsets ?? [])]
    .filter((offset) => Number.isInteger(offset) && offset > 0)
    .sort((left, right) => left - right);

  return normalized.length ? normalized : [...fallback];
}

export function resolvePrimaryInvitationTiming(input: {
  assignmentDate: Date;
  timeSlot: TimeSlot;
  now: Date;
  settings: PrimaryInvitationTimingSettings;
}) {
  const assignmentStartAt = buildAssignmentStartDate({
    date: input.assignmentDate,
    timeSlot: input.timeSlot
  });
  const urgentThresholdHours = normalizePositiveHourSetting(
    input.settings.urgentThresholdHours,
    DEFAULT_URGENT_THRESHOLD_HOURS
  );
  const hoursUntilAssignment =
    (assignmentStartAt.getTime() - input.now.getTime()) / MS_PER_HOUR;
  const urgent = hoursUntilAssignment <= urgentThresholdHours;
  const timeoutHours = urgent
    ? normalizePositiveHourSetting(
        input.settings.urgentPrimaryResponseTimeoutHours,
        DEFAULT_URGENT_PRIMARY_RESPONSE_TIMEOUT_HOURS
      )
    : normalizePositiveHourSetting(
        input.settings.primaryResponseTimeoutHours,
        DEFAULT_PRIMARY_RESPONSE_TIMEOUT_HOURS
      );
  const reminderOffsetsHours = urgent
    ? normalizeReminderOffsetsHours(
        input.settings.urgentPrimaryReminderOffsetsHours,
        DEFAULT_URGENT_PRIMARY_REMINDER_OFFSETS_HOURS
      )
    : normalizeReminderOffsetsHours(
        input.settings.primaryReminderOffsetsHours,
        DEFAULT_PRIMARY_REMINDER_OFFSETS_HOURS
      );
  const timeoutExpiresAt = addHours(input.now, timeoutHours);
  const expiresAt =
    assignmentStartAt > input.now
      ? new Date(
          Math.min(timeoutExpiresAt.getTime(), assignmentStartAt.getTime())
        )
      : input.now;

  return {
    assignmentStartAt,
    expiresAt,
    timeoutHours,
    reminderOffsetsHours,
    urgent,
    urgentThresholdHours
  };
}
