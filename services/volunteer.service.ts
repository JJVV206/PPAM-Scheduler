import { db } from "@/lib/db/prisma";
import type { VolunteerDashboardData, VolunteerSummary } from "@/types/domain";
import { getOpenSlots, getVolunteerHistory } from "@/services/assignment.service";

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
    temporaryUnavailable: record.temporaryUnavailable
  };
}

export async function getVolunteers() {
  const volunteers = await db.volunteerProfile.findMany({
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
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
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

export async function deactivateVolunteer(volunteerId: string) {
  const volunteer = await db.volunteerProfile.findUniqueOrThrow({
    where: { id: volunteerId }
  });

  await db.$transaction([
    db.volunteerProfile.update({
      where: { id: volunteerId },
      data: { active: false }
    }),
    db.user.update({
      where: { id: volunteer.userId },
      data: { active: false }
    })
  ]);
}

export async function getVolunteerDashboardData(
  volunteerProfileId: string
): Promise<VolunteerDashboardData> {
  const [volunteer, assignments, openSlots] = await Promise.all([
    getVolunteer(volunteerProfileId),
    getVolunteerHistory(volunteerProfileId),
    getOpenSlots()
  ]);

  return {
    volunteer,
    upcomingAssignments: assignments.filter(
      (assignment) => assignment.date >= new Date()
    ),
    pendingConfirmations: assignments.filter(
      (assignment) => assignment.status === "PENDING_CONFIRMATION"
    ),
    openSlots: openSlots.filter((slot) =>
      slot.suggestedVolunteers.some((candidate) => candidate.id === volunteerProfileId)
    ),
    weeklyAvailabilitySummary: volunteer.availability.reduce<
      VolunteerDashboardData["weeklyAvailabilitySummary"]
    >((accumulator, item) => {
      const existing = accumulator.find((entry) => entry.dayOfWeek === item.dayOfWeek);
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
