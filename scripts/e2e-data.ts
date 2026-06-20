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
const E2E_VOLUNTEER_PENDING_TOKEN = "e2e-volunteer-pending-token";

const adminEmail =
  process.env.E2E_ADMIN_EMAIL ?? `${E2E_EMAIL_PREFIX}admin${E2E_EMAIL_DOMAIN}`;
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "E2EAdmin123!";
const volunteerEmail =
  process.env.E2E_VOLUNTEER_EMAIL ??
  `${E2E_EMAIL_PREFIX}volunteer${E2E_EMAIL_DOMAIN}`;
const volunteerPassword =
  process.env.E2E_VOLUNTEER_PASSWORD ?? "E2EVolunteer123!";

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
  const fixtures = [
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
    await db.assignment.create({
      data: {
        scheduleWeekId: week.id,
        date: fixture.date,
        dayOfWeek: fixture.dayOfWeek,
        timeSlot: fixture.timeSlot,
        preachingPointId: input.pointId,
        pairNumber: fixture.pairNumber,
        status: "PENDING_CONFIRMATION",
        notes: fixture.notes,
        volunteers: {
          create: {
            volunteerId: input.volunteerProfileId,
            position: "FIRST"
          }
        },
        responses: {
          create: {
            volunteerId: input.volunteerProfileId,
            responseStatus: "PENDING"
          }
        },
        invitations: {
          create: {
            volunteerId: input.volunteerProfileId,
            type: "PRIMARY",
            status: fixture.invitationStatus,
            token: fixture.token,
            expiresAt,
            sentAt: fixture.invitationStatus === "SENT" ? new Date() : null,
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
    volunteerPendingToken: E2E_VOLUNTEER_PENDING_TOKEN,
    emailInvitationToken: E2E_EMAIL_INVITATION_TOKEN,
    weekId: week.id
  };
}

async function seed() {
  assertWriteAllowed();

  const [adminPasswordHash, volunteerPasswordHash] = await Promise.all([
    hashPassword(adminPassword),
    hashPassword(volunteerPassword)
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
