import { startOfDay } from "date-fns";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import type {
  VolunteerAssignmentReminderDto,
  VolunteerDashboardData,
  VolunteerSummary
} from "@/types/domain";
import {
  getOpenSlots,
  getVolunteerHistory
} from "@/services/assignment.service";
import { AppError } from "@/services/errors";
import {
  isVolunteerAssignmentConfirmed,
  isVolunteerAssignmentPendingResponse
} from "@/lib/volunteer-assignment";

const ACTIVE_INVITATION_STATUSES = ["PENDING", "SENT"] as const;
const TERMINAL_ASSIGNMENT_STATUSES = ["CANCELLED", "COMPLETED"] as const;
const VOLUNTEER_DELETED_RESPONSE_NOTE =
  "Voluntario eliminado por administrador.";

function asJsonObject(value: Prisma.JsonValue | null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function compactJsonMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
}

function mergeJsonMetadata(
  current: Prisma.JsonValue | null,
  next: Record<string, unknown>
) {
  return compactJsonMetadata({
    ...asJsonObject(current),
    ...next
  });
}

function mapVolunteer(record: {
  id: string;
  userId: string;
  notes: string | null;
  transportationNotes: string | null;
  preferredAreas: string[];
  reliabilityScore: number;
  confirmationCount: number;
  declineCount: number;
  noResponseCount: number;
  active: boolean;
  temporaryUnavailable: boolean;
  canServeAsReplacement: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    active: boolean;
  };
}): VolunteerSummary {
  return {
    id: record.id,
    userId: record.userId,
    name: record.user.name,
    email: record.user.email,
    phone: record.user.phone,
    active: record.active && record.user.active,
    transportationNotes: record.transportationNotes,
    preferredAreas: record.preferredAreas,
    reliabilityScore: record.reliabilityScore,
    confirmationCount: record.confirmationCount,
    declineCount: record.declineCount,
    noResponseCount: record.noResponseCount,
    temporaryUnavailable: record.temporaryUnavailable,
    canServeAsReplacement: record.canServeAsReplacement
  };
}

export async function getVolunteers(input?: { activeOnly?: boolean }) {
  const volunteers = await db.volunteerProfile.findMany({
    where: input?.activeOnly
      ? {
          active: true,
          user: {
            active: true
          }
        }
      : undefined,
    include: { user: true, availability: true },
    orderBy: { user: { name: "asc" } }
  });

  return volunteers.map((volunteer) => ({
    ...mapVolunteer(volunteer),
    availabilitySummary: volunteer.availability.map((item) => ({
      dayOfWeek: item.dayOfWeek,
      timeSlot: item.timeSlot
    }))
  }));
}

export async function getVolunteer(volunteerId: string) {
  const volunteer = await db.volunteerProfile.findUniqueOrThrow({
    where: { id: volunteerId },
    include: {
      user: true,
      availability: true,
      availabilityBlocks: true
    }
  });

  return {
    ...mapVolunteer(volunteer),
    notes: volunteer.notes,
    availability: volunteer.availability,
    availabilityBlocks: volunteer.availabilityBlocks
  };
}

export async function createVolunteer(input: {
  name: string;
  email: string;
  phone?: string;
  role: "VOLUNTEER" | "ADMIN";
  notes?: string;
  transportationNotes?: string;
  preferredAreas: string[];
  active: boolean;
  passwordHash: string;
}) {
  const normalizedEmail = input.email.toLowerCase();
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: { volunteerProfile: true }
  });

  if (existingUser) {
    throw new AppError(
      existingUser.volunteerProfile
        ? "Ya existe un voluntario registrado con ese correo."
        : "Ya existe una cuenta registrada con ese correo. Usa otro correo o actualiza el registro existente.",
      409
    );
  }

  const user = await db.user.create({
    data: {
      name: input.name,
      email: normalizedEmail,
      phone: input.phone,
      role: input.role,
      active: input.active,
      passwordHash: input.passwordHash,
      volunteerProfile:
        input.role === "VOLUNTEER"
          ? {
              create: {
                notes: input.notes,
                transportationNotes: input.transportationNotes,
                preferredAreas: input.preferredAreas,
                active: input.active
              }
            }
          : undefined
    },
    include: {
      volunteerProfile: true
    }
  });

  return user;
}

export async function updateVolunteer(
  volunteerId: string,
  input: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    transportationNotes?: string;
    preferredAreas?: string[];
    active?: boolean;
    temporaryUnavailable?: boolean;
  }
) {
  const volunteer = await db.volunteerProfile.findUniqueOrThrow({
    where: { id: volunteerId }
  });

  if (input.email) {
    const normalizedEmail = input.email.toLowerCase();
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser && existingUser.id !== volunteer.userId) {
      throw new AppError(
        "Ya existe otra cuenta registrada con ese correo.",
        409
      );
    }
  }

  return db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: volunteer.userId },
      data: {
        name: input.name,
        email: input.email?.toLowerCase(),
        phone: input.phone,
        active: input.active
      }
    });

    return tx.volunteerProfile.update({
      where: { id: volunteerId },
      data: {
        notes: input.notes,
        transportationNotes: input.transportationNotes,
        preferredAreas: input.preferredAreas,
        active: input.active,
        temporaryUnavailable: input.temporaryUnavailable
      },
      include: { user: true }
    });
  });
}

export async function deactivateVolunteer(
  volunteerId: string,
  input?: { actorUserId?: string }
) {
  const volunteer = await db.volunteerProfile.findUniqueOrThrow({
    where: { id: volunteerId },
    include: { user: true }
  });
  const now = new Date();
  const activeFromToday = startOfDay(now);

  return db.$transaction(async (tx) => {
    await tx.volunteerProfile.update({
      where: { id: volunteerId },
      data: { active: false }
    });
    await tx.user.update({
      where: { id: volunteer.userId },
      data: { active: false }
    });

    const activeInvitations = await tx.assignmentInvitation.findMany({
      where: {
        volunteerId,
        status: {
          in: [...ACTIVE_INVITATION_STATUSES]
        }
      },
      select: {
        id: true,
        metadata: true
      }
    });

    for (const invitation of activeInvitations) {
      await tx.assignmentInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "EXPIRED",
          metadata: mergeJsonMetadata(invitation.metadata, {
            expiredBy: "ADMIN_VOLUNTEER_DELETION",
            expiredAt: now.toISOString(),
            actorUserId: input?.actorUserId
          })
        }
      });
    }

    const affectedAssignments = await tx.assignment.findMany({
      where: {
        date: {
          gte: activeFromToday
        },
        status: {
          notIn: [...TERMINAL_ASSIGNMENT_STATUSES]
        },
        volunteers: {
          some: {
            volunteerId
          }
        }
      },
      include: {
        volunteers: {
          where: {
            volunteerId
          }
        }
      }
    });

    for (const assignment of affectedAssignments) {
      const assignedSlot = assignment.volunteers[0];
      const dedupeKey = `volunteer-deleted:${assignment.id}:${volunteerId}`;

      await tx.assignmentResponse.upsert({
        where: {
          assignmentId_volunteerId: {
            assignmentId: assignment.id,
            volunteerId
          }
        },
        update: {
          responseStatus: "DECLINED",
          note: VOLUNTEER_DELETED_RESPONSE_NOTE,
          respondedAt: now
        },
        create: {
          assignmentId: assignment.id,
          volunteerId,
          responseStatus: "DECLINED",
          note: VOLUNTEER_DELETED_RESPONSE_NOTE,
          respondedAt: now
        }
      });

      if (assignment.status !== "NEEDS_REPLACEMENT") {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { status: "NEEDS_REPLACEMENT" }
        });
      }

      const existingActivity = await tx.assignmentActivity.findFirst({
        where: {
          assignmentId: assignment.id,
          actionType: "REPLACEMENT_REQUIRED",
          metadata: {
            path: ["dedupeKey"],
            equals: dedupeKey
          }
        },
        select: { id: true }
      });

      if (!existingActivity) {
        await tx.assignmentActivity.create({
          data: {
            assignmentId: assignment.id,
            actorUserId: input?.actorUserId,
            actionType: "REPLACEMENT_REQUIRED",
            metadata: {
              dedupeKey,
              reason: "volunteer_deleted",
              volunteerProfileId: volunteerId,
              volunteerUserId: volunteer.userId,
              position: assignedSlot?.position,
              previousStatus: assignment.status,
              markedAt: now.toISOString()
            }
          }
        });
      }
    }

    return {
      success: true,
      affectedAssignmentCount: affectedAssignments.length,
      expiredInvitationCount: activeInvitations.length
    };
  });
}

export async function getVolunteerDashboardData(
  volunteerProfileId: string
): Promise<VolunteerDashboardData> {
  const [volunteer, assignments, openSlots] = await Promise.all([
    getVolunteer(volunteerProfileId),
    getVolunteerHistory(volunteerProfileId),
    getOpenSlots()
  ]);
  const now = new Date();
  const futureAssignments = assignments.filter(
    (assignment) => assignment.date >= now
  );
  const remindersByAssignmentId = await getVolunteerAssignmentRemindersById({
    userId: volunteer.userId,
    assignmentIds: assignments.map((assignment) => assignment.id)
  });

  return {
    volunteer,
    upcomingAssignments: futureAssignments,
    pendingConfirmations: futureAssignments.filter((assignment) =>
      isVolunteerAssignmentPendingResponse(assignment, volunteerProfileId)
    ),
    confirmedAssignments: futureAssignments.filter((assignment) =>
      isVolunteerAssignmentConfirmed(assignment, volunteerProfileId)
    ),
    assignmentHistory: assignments.filter(
      (assignment) => assignment.date < now
    ),
    remindersByAssignmentId,
    openSlots: openSlots.filter((slot) =>
      slot.suggestedVolunteers.some(
        (candidate) => candidate.id === volunteerProfileId
      )
    ),
    weeklyAvailabilitySummary: volunteer.availability.reduce<
      VolunteerDashboardData["weeklyAvailabilitySummary"]
    >((accumulator, item) => {
      const existing = accumulator.find(
        (entry) => entry.dayOfWeek === item.dayOfWeek
      );
      if (existing) {
        existing.slots.push(item.timeSlot);
      } else {
        accumulator.push({
          dayOfWeek: item.dayOfWeek,
          slots: [item.timeSlot]
        });
      }
      return accumulator;
    }, [])
  };
}

export async function getVolunteerAssignmentRemindersById(input: {
  userId: string;
  assignmentIds: string[];
}): Promise<Record<string, VolunteerAssignmentReminderDto[]>> {
  if (!input.assignmentIds.length) {
    return {};
  }

  const reminders = await db.notificationLog.findMany({
    where: {
      userId: input.userId,
      assignmentId: {
        in: input.assignmentIds
      },
      type: {
        in: ["REMINDER", "FINAL_REMINDER"]
      },
      status: "SENT"
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return reminders.reduce<Record<string, VolunteerAssignmentReminderDto[]>>(
    (accumulator, reminder) => {
      if (!reminder.assignmentId) return accumulator;

      accumulator[reminder.assignmentId] ??= [];
      accumulator[reminder.assignmentId].push({
        id: reminder.id,
        assignmentId: reminder.assignmentId,
        type: reminder.type as VolunteerAssignmentReminderDto["type"],
        status: reminder.status,
        sentAt: reminder.sentAt,
        createdAt: reminder.createdAt
      });

      return accumulator;
    },
    {}
  );
}
