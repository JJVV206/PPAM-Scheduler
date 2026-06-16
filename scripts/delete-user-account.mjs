#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const email = process.env.MAINTENANCE_DELETE_USER_EMAIL?.trim().toLowerCase();
const confirm = process.env.MAINTENANCE_DELETE_USER_CONFIRM?.trim();

if (!email) {
  console.log("Skipping user deletion: MAINTENANCE_DELETE_USER_EMAIL is not set.");
  process.exit(0);
}

if (confirm !== "DELETE_ACCOUNT") {
  throw new Error(
    "Refusing to delete user. Set MAINTENANCE_DELETE_USER_CONFIRM=DELETE_ACCOUNT."
  );
}

if (process.env.VERCEL_ENV !== "production") {
  throw new Error("Refusing to delete user outside Vercel production.");
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      _count: {
        select: {
          createdCensuses: true,
          createdWeeks: true
        }
      },
      volunteerProfile: {
        select: {
          id: true
        }
      }
    }
  });

  if (!user) {
    console.log(
      JSON.stringify(
        {
          email,
          status: "not-found"
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  if (user._count.createdWeeks > 0 || user._count.createdCensuses > 0) {
    throw new Error(
      [
        `Refusing to delete ${email} because it owns production records.`,
        `createdWeeks=${user._count.createdWeeks}`,
        `createdCensuses=${user._count.createdCensuses}`
      ].join(" ")
    );
  }

  await prisma.user.delete({
    where: {
      id: user.id
    }
  });

  console.log(
    JSON.stringify(
      {
        deletedUserId: user.id,
        email,
        role: user.role,
        status: "deleted",
        volunteerProfileId: user.volunteerProfile?.id ?? null
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
