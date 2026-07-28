import type { DayOfWeek, TimeSlot } from "@prisma/client";

import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";

export const PPAM_TIME_ZONE = "America/Mexico_City";

const DAY_OF_WEEK_BY_NAME: Record<string, DayOfWeek> = {
  Sunday: "SUNDAY",
  Monday: "MONDAY",
  Tuesday: "TUESDAY",
  Wednesday: "WEDNESDAY",
  Thursday: "THURSDAY",
  Friday: "FRIDAY",
  Saturday: "SATURDAY"
};

function getPpamDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PPAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: [values.year, values.month, values.day].join("-"),
    dayOfWeek: DAY_OF_WEEK_BY_NAME[values.weekday] as DayOfWeek
  };
}

export function getPpamDateKey(date: Date) {
  return getPpamDateParts(date).date;
}

export function getPpamDayOfWeek(date: Date): DayOfWeek {
  return getPpamDateParts(date).dayOfWeek;
}

export function parsePpamDateOnly(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;

  const date = new Date(value + "T12:00:00.000Z");
  if (Number.isNaN(date.getTime()) || getPpamDateKey(date) !== value) {
    return null;
  }

  return date;
}

export function assertPpamDayMatchesDate(input: {
  date: Date;
  dayOfWeek: DayOfWeek;
}) {
  return getPpamDayOfWeek(input.date) === input.dayOfWeek;
}

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
