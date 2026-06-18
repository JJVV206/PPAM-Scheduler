import { db } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";

const E2E_EMAIL_PREFIX = "e2e+ppam-";
const E2E_EMAIL_DOMAIN = "@example.invalid";

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
        dayOfWeek: "SATURDAY",
        timeSlot: "SLOT_09_11"
      }
    ],
    skipDuplicates: true
  });

  return point;
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
      name: "E2E Admin",
      passwordHash: adminPasswordHash,
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
      name: "E2E Volunteer",
      passwordHash: volunteerPasswordHash,
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

  console.log(
    JSON.stringify(
      {
        adminEmail,
        pointId: point.id,
        status: "seeded",
        volunteerEmail,
        volunteerProfileId: volunteerProfile.id
      },
      null,
      2
    )
  );
}

async function cleanup() {
  assertWriteAllowed();

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
