import { randomBytes } from "crypto";

import { db } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

const QA_EMAIL_PREFIX = "qa+ppam-";
const QA_EMAIL_DOMAIN = "@example.invalid";

function assertWriteAllowed() {
  if (process.env.ALLOW_QA_DATA_WRITE !== "true") {
    throw new Error(
      "Refusing to write QA data. Set ALLOW_QA_DATA_WRITE=true to confirm this operation."
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
}

function getRunId() {
  return (
    process.env.QA_RUN_ID ??
    new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
  ).toLowerCase();
}

async function seed() {
  assertWriteAllowed();

  const runId = getRunId();
  const email = `${QA_EMAIL_PREFIX}${runId}${QA_EMAIL_DOMAIN}`;
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    console.log(
      JSON.stringify(
        {
          email,
          runId,
          status: "already-exists",
          userId: existing.id
        },
        null,
        2
      )
    );
    return;
  }

  const password = randomBytes(12).toString("hex");
  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      active: true,
      accessStatus: "APPROVED",
      email,
      name: `QA Volunteer ${runId}`,
      passwordHash,
      phone: "000-000-0000",
      role: "VOLUNTEER",
      volunteerProfile: {
        create: {
          active: true,
          notes: `QA_RUN_ID:${runId}`,
          preferredAreas: ["QA"],
          transportationNotes: "QA generated volunteer"
        }
      }
    },
    include: {
      volunteerProfile: true
    }
  });

  if (user.volunteerProfile) {
    await db.volunteerAvailability.createMany({
      data: [
        {
          volunteerId: user.volunteerProfile.id,
          dayOfWeek: "MONDAY",
          timeSlot: "SLOT_09_11",
          areaPreference: "QA"
        },
        {
          volunteerId: user.volunteerProfile.id,
          dayOfWeek: "SATURDAY",
          timeSlot: "SLOT_09_11",
          areaPreference: "QA"
        }
      ],
      skipDuplicates: true
    });
  }

  console.log(
    JSON.stringify(
      {
        email,
        runId,
        passwordGenerated: true,
        status: "created",
        userId: user.id,
        volunteerProfileId: user.volunteerProfile?.id
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
        endsWith: QA_EMAIL_DOMAIN,
        startsWith: QA_EMAIL_PREFIX
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
    throw new Error("Usage: tsx scripts/qa-data.ts <seed|cleanup>");
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
