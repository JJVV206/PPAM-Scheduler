import { existsSync } from "node:fs";
import { join } from "node:path";

import { addDays, addHours, startOfWeek } from "date-fns";
import bcrypt from "bcryptjs";
import {
  AssignmentStatus,
  DayOfWeek,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  ResponseStatus,
  TimeSlot,
  UserRole,
  VolunteerPosition
} from "@prisma/client";

function loadLocalEnv() {
  for (const fileName of [".env", ".env.local"]) {
    const filePath = join(process.cwd(), fileName);
    if (!existsSync(filePath)) continue;

    try {
      process.loadEnvFile(filePath);
    } catch {
      // Ignore malformed or already-loaded local env files here and let the explicit check below fail if needed.
    }
  }
}

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Create .env.local or .env from .env.example before running npm run db:seed."
  );
}

const prisma = new PrismaClient();

async function main() {
  await prisma.notificationLog.deleteMany();
  await prisma.assignmentActivity.deleteMany();
  await prisma.assignmentInvitation.deleteMany();
  await prisma.assignmentResponse.deleteMany();
  await prisma.assignmentVolunteer.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.preachingPointActiveSlot.deleteMany();
  await prisma.scheduleWeek.deleteMany();
  await prisma.availabilityException.deleteMany();
  await prisma.volunteerAvailability.deleteMany();
  await prisma.volunteerProfile.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash("Admin123!", 12);
  const volunteerPasswordHash = await bcrypt.hash("Volunteer123!", 12);

  const [admin, julia, marco, elena] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Coordinator Gabriel",
        email: "admin@ppam.local",
        passwordHash: adminPasswordHash,
        role: UserRole.ADMIN,
        phone: "+1 555 0100"
      }
    }),
    prisma.user.create({
      data: {
        name: "Julia Westbrook",
        email: "julia@ppam.local",
        passwordHash: volunteerPasswordHash,
        role: UserRole.VOLUNTEER,
        phone: "+1 555 0101"
      }
    }),
    prisma.user.create({
      data: {
        name: "Marco Davis",
        email: "marco@ppam.local",
        passwordHash: volunteerPasswordHash,
        role: UserRole.VOLUNTEER,
        phone: "+1 555 0102"
      }
    }),
    prisma.user.create({
      data: {
        name: "Elena Torres",
        email: "elena@ppam.local",
        passwordHash: volunteerPasswordHash,
        role: UserRole.VOLUNTEER,
        phone: "+1 555 0103"
      }
    })
  ]);

  const [juliaProfile, marcoProfile, elenaProfile] = await Promise.all([
    prisma.volunteerProfile.create({
      data: {
        userId: julia.id,
        notes: "Comfortable with early morning assignments.",
        transportationNotes: "Has car.",
        preferredAreas: ["Hospital"],
        confirmationCount: 18,
        declineCount: 1,
        noResponseCount: 0,
        reliabilityScore: 97
      }
    }),
    prisma.volunteerProfile.create({
      data: {
        userId: marco.id,
        notes: "Prefers weekend afternoons.",
        transportationNotes: "Needs partner with car for distant areas.",
        preferredAreas: ["Hospital"],
        confirmationCount: 12,
        declineCount: 2,
        noResponseCount: 1,
        reliabilityScore: 89
      }
    }),
    prisma.volunteerProfile.create({
      data: {
        userId: elena.id,
        notes: "Available on weekdays.",
        transportationNotes: "Public transit only.",
        preferredAreas: ["Hospital"],
        confirmationCount: 16,
        declineCount: 0,
        noResponseCount: 0,
        reliabilityScore: 98
      }
    })
  ]);

  const point = await prisma.preachingPoint.create({
    data: {
      name: "Hospital Dr José G. Parres",
      area: "Hospital",
      notes: "Punto fijo de predicación para toda la operación."
    }
  });

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekEnd = addDays(currentWeekStart, 6);

  const scheduleWeek = await prisma.scheduleWeek.create({
    data: {
      startDate: currentWeekStart,
      endDate: currentWeekEnd,
      label: `Week of ${currentWeekStart.toLocaleDateString()}`,
      createdById: admin.id
    }
  });

  const assignment1 = await prisma.assignment.create({
    data: {
      scheduleWeekId: scheduleWeek.id,
      date: addDays(currentWeekStart, 1),
      dayOfWeek: DayOfWeek.TUESDAY,
      timeSlot: TimeSlot.SLOT_09_11,
      preachingPointId: point.id,
      status: AssignmentStatus.PENDING_CONFIRMATION,
      notes: "Bring literature cart."
    }
  });

  const assignment2 = await prisma.assignment.create({
    data: {
      scheduleWeekId: scheduleWeek.id,
      date: addDays(currentWeekStart, 3),
      dayOfWeek: DayOfWeek.THURSDAY,
      timeSlot: TimeSlot.SLOT_13_15,
      preachingPointId: point.id,
      status: AssignmentStatus.NEEDS_REPLACEMENT
    }
  });

  const assignment3 = await prisma.assignment.create({
    data: {
      scheduleWeekId: scheduleWeek.id,
      date: addDays(currentWeekStart, 4),
      dayOfWeek: DayOfWeek.FRIDAY,
      timeSlot: TimeSlot.SLOT_11_13,
      preachingPointId: point.id,
      status: AssignmentStatus.CONFIRMED
    }
  });

  await prisma.assignmentVolunteer.createMany({
    data: [
      {
        assignmentId: assignment1.id,
        volunteerId: juliaProfile.id,
        position: VolunteerPosition.FIRST
      },
      {
        assignmentId: assignment1.id,
        volunteerId: marcoProfile.id,
        position: VolunteerPosition.SECOND
      },
      {
        assignmentId: assignment2.id,
        volunteerId: elenaProfile.id,
        position: VolunteerPosition.FIRST
      },
      {
        assignmentId: assignment3.id,
        volunteerId: juliaProfile.id,
        position: VolunteerPosition.FIRST
      },
      {
        assignmentId: assignment3.id,
        volunteerId: elenaProfile.id,
        position: VolunteerPosition.SECOND
      }
    ]
  });

  await prisma.assignmentResponse.createMany({
    data: [
      {
        assignmentId: assignment1.id,
        volunteerId: juliaProfile.id,
        responseStatus: ResponseStatus.CONFIRMED,
        respondedAt: addHours(new Date(), -8)
      },
      {
        assignmentId: assignment1.id,
        volunteerId: marcoProfile.id,
        responseStatus: ResponseStatus.PENDING
      },
      {
        assignmentId: assignment2.id,
        volunteerId: elenaProfile.id,
        responseStatus: ResponseStatus.DECLINED,
        note: "Out of town",
        respondedAt: addHours(new Date(), -12)
      },
      {
        assignmentId: assignment3.id,
        volunteerId: juliaProfile.id,
        responseStatus: ResponseStatus.CONFIRMED,
        respondedAt: addHours(new Date(), -36)
      },
      {
        assignmentId: assignment3.id,
        volunteerId: elenaProfile.id,
        responseStatus: ResponseStatus.CONFIRMED,
        respondedAt: addHours(new Date(), -24)
      }
    ]
  });

  await prisma.assignmentActivity.createMany({
    data: [
      {
        assignmentId: assignment1.id,
        actorUserId: admin.id,
        actionType: "ASSIGNED",
        metadata: { note: "Initial weekly placement" }
      },
      {
        assignmentId: assignment1.id,
        actorUserId: admin.id,
        actionType: "REMINDER_SENT"
      },
      {
        assignmentId: assignment2.id,
        actorUserId: admin.id,
        actionType: "RESPONSE_RECEIVED",
        metadata: { responseStatus: "DECLINED" }
      }
    ]
  });

  await prisma.volunteerAvailability.createMany({
    data: [
      {
        volunteerId: juliaProfile.id,
        dayOfWeek: DayOfWeek.TUESDAY,
        timeSlot: TimeSlot.SLOT_09_11,
        areaPreference: "Hospital"
      },
      {
        volunteerId: juliaProfile.id,
        dayOfWeek: DayOfWeek.FRIDAY,
        timeSlot: TimeSlot.SLOT_11_13,
        areaPreference: "Hospital"
      },
      {
        volunteerId: marcoProfile.id,
        dayOfWeek: DayOfWeek.TUESDAY,
        timeSlot: TimeSlot.SLOT_09_11,
        areaPreference: "Hospital"
      },
      {
        volunteerId: elenaProfile.id,
        dayOfWeek: DayOfWeek.THURSDAY,
        timeSlot: TimeSlot.SLOT_13_15,
        areaPreference: "Hospital"
      }
    ]
  });

  await prisma.appSetting.createMany({
    data: [
      {
        key: "confirmationLeadDays",
        value: 8
      },
      {
        key: "reminderTimingDays",
        value: [8, 3, 1]
      },
      {
        key: "notificationChannels",
        value: ["EMAIL"]
      }
    ]
  });

  await prisma.notificationLog.create({
    data: {
      userId: marco.id,
      assignmentId: assignment1.id,
      type: NotificationType.CONFIRMATION_REQUEST,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      metadata: { subject: "Please confirm your PPAM assignment" }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
