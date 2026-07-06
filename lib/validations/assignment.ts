import { z } from "zod";

import {
  ASSIGNMENT_STATUSES,
  DAYS_OF_WEEK,
  TIME_SLOTS
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
  volunteerId: z.string().min(1, "Debes seleccionar un voluntario."),
  slotNumber: z.number().int().min(1, "El número de integrante no es válido.")
});

function requireUniqueAssignmentVolunteers(
  volunteers: Array<{ volunteerId: string; slotNumber: number }>,
  context: z.RefinementCtx
) {
  const volunteerIds = new Set<string>();
  const slotNumbers = new Set<number>();

  volunteers.forEach((volunteer, index) => {
    if (volunteerIds.has(volunteer.volunteerId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No puedes seleccionar el mismo voluntario dos veces.",
        path: [index, "volunteerId"]
      });
    }
    volunteerIds.add(volunteer.volunteerId);

    if (slotNumbers.has(volunteer.slotNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cada integrante debe tener un número único.",
        path: [index, "slotNumber"]
      });
    }
    slotNumbers.add(volunteer.slotNumber);
  });
}

export const createAssignmentSchema = z.object({
  scheduleWeekId: z.string().min(1, "La semana es obligatoria."),
  date: z.string().datetime(),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  timeSlot: z.enum(TIME_SLOTS),
  preachingPointId: z
    .string()
    .min(1, "Debes seleccionar un punto de predicación."),
  notes: z.string().max(1000, "No excedas 1000 caracteres.").optional(),
  volunteers: z
    .array(assignmentVolunteerInputSchema)
    .superRefine(requireUniqueAssignmentVolunteers)
});

export const updateAssignmentSchema = z.object({
  date: z.string().datetime().optional(),
  dayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
  timeSlot: z.enum(TIME_SLOTS).optional(),
  preachingPointId: z.string().optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  notes: z
    .string()
    .max(1000, "No excedas 1000 caracteres.")
    .nullable()
    .optional(),
  volunteers: z
    .array(assignmentVolunteerInputSchema)
    .superRefine(requireUniqueAssignmentVolunteers)
    .optional()
});

export const assignmentPreflightSchema = z.object({
  assignmentId: z.string().optional(),
  date: z.string().datetime(),
  timeSlot: z.enum(TIME_SLOTS),
  volunteerIds: z
    .array(z.string().min(1))
    .superRefine((volunteerIds, context) => {
      const uniqueIds = new Set<string>();
      volunteerIds.forEach((volunteerId, index) => {
        if (uniqueIds.has(volunteerId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "No puedes seleccionar el mismo voluntario dos veces.",
            path: [index]
          });
        }
        uniqueIds.add(volunteerId);
      });
    })
});

export const confirmAssignmentSchema = z.object({
  note: z.string().max(500, "No excedas 500 caracteres.").optional()
});

export const declineAssignmentSchema = z.object({
  note: z
    .string()
    .min(3, "La nota debe tener al menos 3 caracteres.")
    .max(500, "No excedas 500 caracteres.")
    .optional()
});

export const replacementAssignmentSchema = z.object({
  volunteerId: z.string().min(1, "Debes seleccionar un voluntario."),
  slotNumber: z.number().int().min(1).optional()
});
