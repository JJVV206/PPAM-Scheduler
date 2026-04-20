import { z } from "zod";

import {
  ASSIGNMENT_STATUSES,
  DAYS_OF_WEEK,
  TIME_SLOTS,
  VOLUNTEER_POSITIONS
} from "@/lib/constants/domain";

export const assignmentFiltersSchema = z.object({
  volunteerId: z.string().optional(),
  pointId: z.string().optional(),
  date: z.string().optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  search: z.string().optional()
});

export const scheduleFiltersSchema = z.object({
  weekStart: z.string().optional(),
  day: z.enum(DAYS_OF_WEEK).optional(),
  pointId: z.string().optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional()
});

export const assignmentVolunteerInputSchema = z.object({
  volunteerId: z.string().min(1),
  position: z.enum(VOLUNTEER_POSITIONS)
});

export const createAssignmentSchema = z.object({
  scheduleWeekId: z.string().min(1),
  date: z.string().datetime(),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  timeSlot: z.enum(TIME_SLOTS),
  preachingPointId: z.string().min(1),
  notes: z.string().max(1000).optional(),
  volunteers: z.array(assignmentVolunteerInputSchema).max(2)
});

export const updateAssignmentSchema = z.object({
  date: z.string().datetime().optional(),
  dayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
  timeSlot: z.enum(TIME_SLOTS).optional(),
  preachingPointId: z.string().optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  notes: z.string().max(1000).nullable().optional(),
  volunteers: z.array(assignmentVolunteerInputSchema).max(2).optional()
});

export const confirmAssignmentSchema = z.object({
  note: z.string().max(500).optional()
});

export const declineAssignmentSchema = z.object({
  note: z.string().min(3).max(500).optional()
});

export const replacementAssignmentSchema = z.object({
  volunteerId: z.string().min(1),
  position: z.enum(VOLUNTEER_POSITIONS).optional()
});
