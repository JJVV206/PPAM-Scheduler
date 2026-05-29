import type { TimeSlot } from "@/types/domain";

export const USER_ROLES = ["ADMIN", "VOLUNTEER"] as const;
export const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
] as const;
export const TIME_SLOTS = [
  "SLOT_07_09",
  "SLOT_09_11",
  "SLOT_11_13",
  "SLOT_13_15",
  "SLOT_15_17"
] as const;
export const ASSIGNMENT_STATUSES = [
  "SCHEDULED",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "DECLINED",
  "NEEDS_REPLACEMENT",
  "REASSIGNED",
  "COMPLETED",
  "CANCELLED"
] as const;
export const RESPONSE_STATUSES = ["PENDING", "CONFIRMED", "DECLINED"] as const;
export const VOLUNTEER_POSITIONS = ["FIRST", "SECOND"] as const;
export const NOTIFICATION_TYPES = [
  "CONFIRMATION_REQUEST",
  "REMINDER",
  "REPLACEMENT_OPPORTUNITY",
  "FINAL_REMINDER",
  "RESET_PASSWORD",
  "ASSIGNMENT_UPDATE"
] as const;
export const NOTIFICATION_CHANNELS = ["EMAIL", "SMS", "WHATSAPP", "IN_APP"] as const;
export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "FAILED"] as const;
export const ASSIGNMENT_ACTIVITY_TYPES = [
  "ASSIGNED",
  "REMINDER_SENT",
  "RESPONSE_RECEIVED",
  "REPLACEMENT_ASSIGNED",
  "STATUS_OVERRIDDEN",
  "COMPLETED",
  "CANCELLED",
  "NOTES_UPDATED"
] as const;

export const TIME_SLOT_DEFINITIONS: Record<
  TimeSlot,
  {
    label: string;
    shortLabel: string;
    start: string;
    end: string;
  }
> = {
  SLOT_07_09: {
    label: "7:00 AM - 9:00 AM",
    shortLabel: "7-9 AM",
    start: "07:00",
    end: "09:00"
  },
  SLOT_09_11: {
    label: "9:00 AM - 11:00 AM",
    shortLabel: "9-11 AM",
    start: "09:00",
    end: "11:00"
  },
  SLOT_11_13: {
    label: "11:00 AM - 1:00 PM",
    shortLabel: "11-1 PM",
    start: "11:00",
    end: "13:00"
  },
  SLOT_13_15: {
    label: "1:00 PM - 3:00 PM",
    shortLabel: "1-3 PM",
    start: "13:00",
    end: "15:00"
  },
  SLOT_15_17: {
    label: "3:00 PM - 5:00 PM",
    shortLabel: "3-5 PM",
    start: "15:00",
    end: "17:00"
  }
};

export const DAY_LABELS = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday"
} as const;
