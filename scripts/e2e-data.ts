import { db } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";

const E2E_EMAIL_PREFIX = "e2e+ppam-";
const E2E_EMAIL_DOMAIN = "@example.invalid";
const E2E_WEEK_LABEL = "E2E QA Week";
const E2E_WEEK_START = new Date("2026-07-20T00:00:00.000Z");
const E2E_WEEK_END = addDays(E2E_WEEK_START, 6);
const E2E_EMAIL_INVITATION_TOKEN = "e2e-email-flow-token";
const E2E_PUBLIC_CONFIRMATION_TOKEN = "e2e-public-confirmation-token";
const E2E_PUBLIC_DECLINE_TOKEN = "e2e-public-decline-token";
const E2E_PUBLIC_EXPIRED_TOKEN = "e2e-public-expired-token";
const E2E_PUBLIC_RESPONDED_TOKEN = "e2e-public-responded-token";
const E2E_VOLUNTEER_AUTH_CONFIRM_TOKEN = "e2e-volunteer-auth-confirm-token";
const E2E_VOLUNTEER_PENDING_TOKEN = "e2e-volunteer-pending-token";

const adminEmail =
  process.env.E2E_ADMIN_EMAIL ?? `${E2E_EMAIL_PREFIX}admin${E2E_EMAIL_DOMAIN}`;
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "E2EAdmin123!";
const volunteerEmail =
  process.env.E2E_VOLUNTEER_EMAIL ??
  `${E2E_EMAIL_PREFIX}volunteer${E2E_EMAIL_DOMAIN}`;
const volunteerPassword =
  process.env.E2E_VOLUNTEER_PASSWORD ?? "E2EVolunteer123!";
const replacementEmail =
  process.env.E2E_REPLACEMENT_EMAIL ??
  `${E2E_EMAIL_PREFIX}replacement${E2E_EMAIL_DOMAIN}`;
const replacementPassword =
  process.env.E2E_REPLACEMENT_PASSWORD ?? "E2EReplacement123!";

function assertWriteAllowed() {
  if (process.env.ALLOW_E2E_DATA_WRITE !== "true") {
    throw new Error(
      "Refusing to write E2E data. Set ALLOW_E2E_DATA_WRITE=true to confirm this operation."
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

type E2eAssignmentFixture = {
  assignmentStatus?:
    | "SCHEDULED"
    | "PENDING_CONFIRMATION"
    | "CONFIRMED"
    | "DECLINED"
    | "NEEDS_REPLACEMENT"
    | "REASSIGNED"
    | "COMPLETED"
    | "CANCELLED";
  date: Date;
  dayOfWeek:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";
  expiresAt?: Date;
  invitationStatus: "PENDING" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  notes: string;
  pairNumber: number;
  respondedAt?: Date | null;
  responseStatus?: "PENDING" | "CONFIRMED" | "DECLINED";
  timeSlot:
    | "SLOT_07_09"
    | "SLOT_09_11"
    | "SLOT_11_13"
    | "SLOT_13_15"
    | "SLOT_15_17";
  token: string;
};

async function ensurePreachingPoint() {
  const point =
    (await db.preachingPoint.findFirst({
      where: {
        name: FIXED_PREACHING_POINT_NAME
      }
    })) ??
    (await db.preachingPoint.create({
      data: {
        name: FIXED_PREACHING_POINT_NAME,
        area: "E2E",
        notes: "Created by E2E seed",
        active: true
      }
    }));

  await db.preachingPointActiveSlot.createMany({
    data: [
      {
        preachingPointId: point.id,
        dayOfWeek: "MONDAY",
        timeSlot: "SLOT_09_11"
      },
      {
        preachingPointId: point.id,
        dayOfWeek: "TUESDAY",
        timeSlot: "SLOT_11_13"
      },
      {
        preachingPointId: point.id,
        dayOfWeek: "SATURDAY",
        timeSlot: "SLOT_09_11"
      }
    ],
    skipDuplicates: true
  });

  return point;
}

async function resetE2eAssignments() {
  await db.scheduleWeek.deleteMany({
    where: {
      OR: [
        {
          label: {
            startsWith: E2E_WEEK_LABEL
          }
        },
        {
          startDate: E2E_WEEK_START,
          endDate: E2E_WEEK_END
        }
      ]
    }
  });
}

async function seedAssignmentFixtures(input: {
  adminUserId: string;
  pointId: string;
  volunteerProfileId: string;
}) {
  await resetE2eAssignments();

  const week = await db.scheduleWeek.create({
    data: {
      startDate: E2E_WEEK_START,
      endDate: E2E_WEEK_END,
      label: E2E_WEEK_LABEL,
      createdById: input.adminUserId
    }
  });
  const expiresAt = addHours(new Date(), 48);
  const expiredAt = addHours(new Date(), -2);
  const respondedAt = addHours(new Date(), -1);
  const fixtures: E2eAssignmentFixture[] = [
    {
      date: E2E_WEEK_START,
      dayOfWeek: "MONDAY" as const,
      timeSlot: "SLOT_09_11" as const,
      pairNumber: 1,
      notes: "E2E email notification flow",
      token: E2E_EMAIL_INVITATION_TOKEN,
      invitationStatus: "PENDING" as const
    },
    {
      date: addDays(E2E_WEEK_START, 1),
      dayOfWeek: "TUESDAY" as const,
      timeSlot: "SLOT_11_13" as const,
      pairNumber: 1,
      notes: "E2E public confirmation flow",
      token: E2E_PUBLIC_CONFIRMATION_TOKEN,
      invitationStatus: "SENT" as const
    },
    {
      date: addDays(E2E_WEEK_START, 1),
      dayOfWeek: "TUESDAY" as const,
      timeSlot: "SLOT_11_13" as const,
      pairNumber: 2,
      notes: "E2E public decline replacement flow",
      token: E2E_PUBLIC_DECLINE_TOKEN,
      invitationStatus: "SENT" as const
    },
    {
      date: addDays(E2E_WEEK_START, 2),
      dayOfWeek: "WEDNESDAY" as const,
      timeSlot: "SLOT_13_15" as const,
      pairNumber: 1,
      notes: "E2E public expired token flow",
      token: E2E_PUBLIC_EXPIRED_TOKEN,
      invitationStatus: "SENT" as const,
      expiresAt: expiredAt
    },
    {
      date: addDays(E2E_WEEK_START, 3),
      dayOfWeek: "THURSDAY" as const,
      timeSlot: "SLOT_15_17" as const,
      pairNumber: 1,
      notes: "E2E public responded token flow",
      token: E2E_PUBLIC_RESPONDED_TOKEN,
      invitationStatus: "ACCEPTED" as const,
      responseStatus: "CONFIRMED" as const,
      respondedAt,
      assignmentStatus: "CONFIRMED" as const
    },
    {
      date: addDays(E2E_WEEK_START, 4),
      dayOfWeek: "FRIDAY" as const,
      timeSlot: "SLOT_09_11" as const,
      pairNumber: 1,
      notes: "E2E volunteer authenticated confirm flow",
      token: E2E_VOLUNTEER_AUTH_CONFIRM_TOKEN,
      invitationStatus: "SENT" as const
    },
    {
      date: addDays(E2E_WEEK_START, 5),
      dayOfWeek: "SATURDAY" as const,
      timeSlot: "SLOT_09_11" as const,
      pairNumber: 1,
      notes: "E2E volunteer pending flow",
      token: E2E_VOLUNTEER_PENDING_TOKEN,
      invitationStatus: "SENT" as const
    }
  ];

  for (const fixture of fixtures) {
    const responseStatus = fixture.responseStatus ?? "PENDING";
    const respondedAtValue = fixture.respondedAt ?? null;

    await db.assignment.create({
      data: {
        scheduleWeekId: week.id,
        date: fixture.date,
        dayOfWeek: fixture.dayOfWeek,
        timeSlot: fixture.timeSlot,
        preachingPointId: input.pointId,
        pairNumber: fixture.pairNumber,
        status: fixture.assignmentStatus ?? "PENDING_CONFIRMATION",
        notes: fixture.notes,
        volunteers: {
          create: {
            volunteerId: input.volunteerProfileId,
            slotNumber: 1
          }
        },
        responses: {
          create: {
            volunteerId: input.volunteerProfileId,
            responseStatus,
            respondedAt: respondedAtValue
          }
        },
        invitations: {
          create: {
            volunteerId: input.volunteerProfileId,
            type: "PRIMARY",
            status: fixture.invitationStatus,
            token: fixture.token,
            expiresAt: fixture.expiresAt ?? expiresAt,
            sentAt:
              fixture.invitationStatus === "SENT" ||
              fixture.invitationStatus === "ACCEPTED"
                ? new Date()
                : null,
            respondedAt: respondedAtValue,
            metadata: {
              source: "e2e_seed"
            }
          }
        },
        activities: {
          create: [
            {
              actorUserId: input.adminUserId,
              actionType: "ASSIGNED",
              metadata: {
                source: "e2e_seed"
              }
            },
            {
              actorUserId: input.adminUserId,
              actionType: "INVITATION_CREATED",
              metadata: {
                source: "e2e_seed",
                invitationType: "PRIMARY",
                volunteerProfileId: input.volunteerProfileId
              }
            }
          ]
        }
      }
    });
  }

  return {
    publicConfirmationToken: E2E_PUBLIC_CONFIRMATION_TOKEN,
    publicDeclineToken: E2E_PUBLIC_DECLINE_TOKEN,
    publicExpiredToken: E2E_PUBLIC_EXPIRED_TOKEN,
    publicRespondedToken: E2E_PUBLIC_RESPONDED_TOKEN,
    volunteerAuthConfirmToken: E2E_VOLUNTEER_AUTH_CONFIRM_TOKEN,
    volunteerPendingToken: E2E_VOLUNTEER_PENDING_TOKEN,
    emailInvitationToken: E2E_EMAIL_INVITATION_TOKEN,
    weekId: week.id
  };
}

async function seed() {
  assertWriteAllowed();

  const [adminPasswordHash, volunteerPasswordHash, replacementPasswordHash] =
    await Promise.all([
      hashPassword(adminPassword),
      hashPassword(volunteerPassword),
      hashPassword(replacementPassword)
    ]);

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {
      active: true,
      accessStatus: "APPROVED",
      name: "E2E Admin",
      passwordHash: adminPasswordHash,
      phone: "000-000-0000",
      role: "ADMIN"
    },
    create: {
      active: true,
      email: adminEmail,
      name: "E2E Admin",
      passwordHash: adminPasswordHash,
      phone: "000-000-0000",
      role: "ADMIN"
    }
  });

  const volunteer = await db.user.upsert({
    where: { email: volunteerEmail },
    update: {
      active: true,
      accessStatus: "APPROVED",
      name: "E2E Volunteer",
      passwordHash: volunteerPasswordHash,
      phone: "000-000-0001",
      role: "VOLUNTEER"
    },
    create: {
      active: true,
      email: volunteerEmail,
      name: "E2E Volunteer",
      passwordHash: volunteerPasswordHash,
      phone: "000-000-0001",
      role: "VOLUNTEER"
    }
  });

  const replacement = await db.user.upsert({
    where: { email: replacementEmail },
    update: {
      active: true,
      accessStatus: "APPROVED",
      name: "E2E Replacement",
      passwordHash: replacementPasswordHash,
      phone: "000-000-0002",
      role: "VOLUNTEER"
    },
    create: {
      active: true,
      email: replacementEmail,
      name: "E2E Replacement",
      passwordHash: replacementPasswordHash,
      phone: "000-000-0002",
      role: "VOLUNTEER"
    }
  });

  const volunteerProfile = await db.volunteerProfile.upsert({
    where: { userId: volunteer.id },
    update: {
      active: true,
      canServeAsReplacement: true,
      notes: "Created by E2E seed",
      preferredAreas: ["E2E"],
      temporaryUnavailable: false,
      transportationNotes: "E2E generated volunteer"
    },
    create: {
      userId: volunteer.id,
      active: true,
      canServeAsReplacement: true,
      notes: "Created by E2E seed",
      preferredAreas: ["E2E"],
      temporaryUnavailable: false,
      transportationNotes: "E2E generated volunteer"
    }
  });

  const replacementProfile = await db.volunteerProfile.upsert({
    where: { userId: replacement.id },
    update: {
      active: true,
      canServeAsPrimary: false,
      canServeAsReplacement: true,
      notes: "Created by E2E seed",
      preferredAreas: ["E2E"],
      reliabilityScore: 100,
      temporaryUnavailable: false,
      transportationNotes: "E2E generated replacement volunteer"
    },
    create: {
      userId: replacement.id,
      active: true,
      canServeAsPrimary: false,
      canServeAsReplacement: true,
      notes: "Created by E2E seed",
      preferredAreas: ["E2E"],
      reliabilityScore: 100,
      temporaryUnavailable: false,
      transportationNotes: "E2E generated replacement volunteer"
    }
  });

  await db.volunteerAvailability.createMany({
    data: [
      {
        volunteerId: volunteerProfile.id,
        dayOfWeek: "MONDAY",
        timeSlot: "SLOT_09_11",
        areaPreference: "E2E"
      },
      {
        volunteerId: volunteerProfile.id,
        dayOfWeek: "SATURDAY",
        timeSlot: "SLOT_09_11",
        areaPreference: "E2E"
      }
    ],
    skipDuplicates: true
  });

  await db.volunteerAvailability.createMany({
    data: [
      {
        volunteerId: replacementProfile.id,
        dayOfWeek: "TUESDAY",
        timeSlot: "SLOT_11_13",
        areaPreference: "E2E"
      },
      {
        volunteerId: replacementProfile.id,
        dayOfWeek: "FRIDAY",
        timeSlot: "SLOT_09_11",
        areaPreference: "E2E"
      }
    ],
    skipDuplicates: true
  });

  const point = await ensurePreachingPoint();
  const assignmentFixtures = await seedAssignmentFixtures({
    adminUserId: admin.id,
    pointId: point.id,
    volunteerProfileId: volunteerProfile.id
  });

  console.log(
    JSON.stringify(
      {
        adminEmail,
        pointId: point.id,
        replacementEmail,
        replacementProfileId: replacementProfile.id,
        status: "seeded",
        volunteerEmail,
        volunteerProfileId: volunteerProfile.id,
        ...assignmentFixtures
      },
      null,
      2
    )
  );
}

async function cleanup() {
  assertWriteAllowed();

  await resetE2eAssignments();

  const users = await db.user.findMany({
    where: {
      email: {
        startsWith: E2E_EMAIL_PREFIX,
        endsWith: E2E_EMAIL_DOMAIN
      }
    },
    select: {
      email: true,
      id: true
    }
  });

  const deleted = await db.user.deleteMany({
    where: {
      id: {
        in: users.map((user) => user.id)
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        deletedUsers: deleted.count,
        emails: users.map((user) => user.email),
        status: "cleaned"
      },
      null,
      2
    )
  );
}

async function main() {
  const command = process.argv[2];

  if (command === "seed") {
    await seed();
  } else if (command === "cleanup") {
    await cleanup();
  } else {
    throw new Error("Usage: tsx scripts/e2e-data.ts <seed|cleanup>");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
