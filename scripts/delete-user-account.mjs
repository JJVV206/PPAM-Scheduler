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

function getArchivedEmail(userId) {
  return `archived-${Date.now()}-${userId}@ppam.deleted.local`;
}

async function main() {
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
    return;
  }

  if (user._count.createdWeeks > 0 || user._count.createdCensuses > 0) {
    const archivedEmail = getArchivedEmail(user.id);

    await prisma.$transaction([
      prisma.session.deleteMany({
        where: {
          userId: user.id
        }
      }),
      prisma.account.deleteMany({
        where: {
          userId: user.id
        }
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id
        }
      }),
      ...(user.volunteerProfile
        ? [
            prisma.volunteerProfile.update({
              where: {
                id: user.volunteerProfile.id
              },
              data: {
                active: false,
                canServeAsReplacement: false,
                temporaryUnavailable: true
              }
            })
          ]
        : []),
      prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          active: false,
          email: archivedEmail
        }
      })
    ]);

    console.log(
      JSON.stringify(
        {
          archivedEmail,
          archivedUserId: user.id,
          createdCensuses: user._count.createdCensuses,
          createdWeeks: user._count.createdWeeks,
          releasedEmail: email,
          role: user.role,
          status: "archived-email-released",
          volunteerProfileId: user.volunteerProfile?.id ?? null
        },
        null,
        2
      )
    );
    return;
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
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
