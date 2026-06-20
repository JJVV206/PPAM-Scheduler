import { startOfDay } from "date-fns";

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
import { mergeJsonMetadata } from "@/lib/utils/safe-metadata";
import { recordAssignmentAuditActivity } from "@/services/assignment-audit.service";
import {
  deriveVolunteerServiceType,
  hasVolunteerServiceCapacity
} from "@/lib/volunteer-service-type";

const ACTIVE_INVITATION_STATUSES = ["PENDING", "SENT"] as const;
const TERMINAL_ASSIGNMENT_STATUSES = ["CANCELLED", "COMPLETED"] as const;
const VOLUNTEER_DELETED_RESPONSE_NOTE =
  "Voluntario eliminado por administrador.";

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
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    active: boolean;
    accessStatus: string;
  };
}): VolunteerSummary {
  return {
    id: record.id,
    userId: record.userId,
    name: record.user.name,
    email: record.user.email,
    phone: record.user.phone,
    active:
      record.active &&
      record.user.active &&
      record.user.accessStatus === "APPROVED",
    transportationNotes: record.transportationNotes,
    preferredAreas: record.preferredAreas,
    reliabilityScore: record.reliabilityScore,
    confirmationCount: record.confirmationCount,
    declineCount: record.declineCount,
    noResponseCount: record.noResponseCount,
    temporaryUnavailable: record.temporaryUnavailable,
    canServeAsPrimary: record.canServeAsPrimary,
    canServeAsReplacement: record.canServeAsReplacement,
    serviceType: deriveVolunteerServiceType(record)
  };
}

function assertActiveVolunteerHasCapacity(input: {
  active: boolean;
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
}) {
  if (!input.active) return;
  if (hasVolunteerServiceCapacity(input)) return;

  throw new AppError(
    "Un perfil voluntario activo debe tener al menos una capacidad operativa.",
    400
  );
}

export async function getVolunteers(input?: { activeOnly?: boolean }) {
  const volunteers = await db.volunteerProfile.findMany({
    where: input?.activeOnly
      ? {
          active: true,
          user: {
            active: true,
            accessStatus: "APPROVED"
          }
        }
      : {
          user: {
            accessStatus: {
              notIn: ["PENDING_APPROVAL", "REJECTED"]
            }
          }
        },
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
  phone: string;
  role: "VOLUNTEER" | "ADMIN";
  notes?: string;
  transportationNotes?: string;
  preferredAreas: string[];
  active: boolean;
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
  passwordHash: string;
}) {
  const normalizedEmail = input.email.toLowerCase();
  const normalizedPhone = input.phone.trim();
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

  if (input.role === "VOLUNTEER") {
    assertActiveVolunteerHasCapacity({
      active: input.active,
      canServeAsPrimary: input.canServeAsPrimary,
      canServeAsReplacement: input.canServeAsReplacement
    });
  }

  const user = await db.user.create({
    data: {
      name: input.name,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: input.role,
      active: input.active,
      accessStatus: input.active ? "APPROVED" : "SUSPENDED",
      passwordHash: input.passwordHash,
      volunteerProfile:
        input.role === "VOLUNTEER"
          ? {
              create: {
                notes: input.notes,
                transportationNotes: input.transportationNotes,
                preferredAreas: input.preferredAreas,
                active: input.active,
                canServeAsPrimary: input.canServeAsPrimary,
                canServeAsReplacement: input.canServeAsReplacement
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
    canServeAsPrimary?: boolean;
    canServeAsReplacement?: boolean;
  }
) {
  const volunteer = await db.volunteerProfile.findUniqueOrThrow({
    where: { id: volunteerId },
    select: {
      id: true,
      userId: true,
      active: true,
      canServeAsPrimary: true,
      canServeAsReplacement: true
    }
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

  const nextActive = input.active ?? volunteer.active;
  const nextCanServeAsPrimary =
    input.canServeAsPrimary ?? volunteer.canServeAsPrimary;
  const nextCanServeAsReplacement =
    input.canServeAsReplacement ?? volunteer.canServeAsReplacement;

  assertActiveVolunteerHasCapacity({
    active: nextActive,
    canServeAsPrimary: nextCanServeAsPrimary,
    canServeAsReplacement: nextCanServeAsReplacement
  });

  return db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: volunteer.userId },
      data: {
        name: input.name,
        email: input.email?.toLowerCase(),
        phone: input.phone,
        active: input.active,
        accessStatus:
          input.active === undefined
            ? undefined
            : input.active
              ? "APPROVED"
              : "SUSPENDED"
      }
    });

    return tx.volunteerProfile.update({
      where: { id: volunteerId },
      data: {
        notes: input.notes,
        transportationNotes: input.transportationNotes,
        preferredAreas: input.preferredAreas,
        active: input.active,
        temporaryUnavailable: input.temporaryUnavailable,
        canServeAsPrimary: input.canServeAsPrimary,
        canServeAsReplacement: input.canServeAsReplacement
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
      data: {
        active: false,
        temporaryUnavailable: true,
        canServeAsPrimary: false,
        canServeAsReplacement: false
      }
    });
    await tx.user.update({
      where: { id: volunteer.userId },
      data: {
        active: false,
        accessStatus: "SUSPENDED"
      }
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

      await recordAssignmentAuditActivity({
        client: tx,
        assignmentId: assignment.id,
        actorUserId: input?.actorUserId,
        event: "REPLACEMENT_REQUIRED",
        dedupeKey,
        metadata: {
          reason: "volunteer_deleted",
          volunteerProfileId: volunteerId,
          volunteerUserId: volunteer.userId,
          position: assignedSlot?.position,
          previousStatus: assignment.status,
          markedAt: now
        }
      });
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
    openSlots: volunteer.canServeAsReplacement
      ? openSlots.filter((slot) =>
          slot.suggestedVolunteers.some(
            (candidate) => candidate.id === volunteerProfileId
          )
        )
      : [],
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
