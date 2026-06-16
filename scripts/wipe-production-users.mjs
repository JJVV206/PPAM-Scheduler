#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const confirm = process.env.MAINTENANCE_WIPE_USERS_CONFIRM?.trim();

if (!confirm) {
  console.log("Skipping user wipe: MAINTENANCE_WIPE_USERS_CONFIRM is not set.");
  process.exit(0);
}

if (confirm !== "WIPE_PRODUCTION_USERS") {
  throw new Error(
    "Refusing to wipe users. Set MAINTENANCE_WIPE_USERS_CONFIRM=WIPE_PRODUCTION_USERS."
  );
}

if (process.env.VERCEL_ENV !== "production") {
  throw new Error("Refusing to wipe users outside Vercel production.");
}

const prisma = new PrismaClient();

async function getCounts() {
  const [
    users,
    volunteerProfiles,
    scheduleWeeks,
    assignments,
    replacementCensuses,
    notificationLogs,
    appNotifications,
    sessions,
    accounts,
    passwordResetTokens
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.volunteerProfile.count(),
    prisma.scheduleWeek.count(),
    prisma.assignment.count(),
    prisma.replacementCensus.count(),
    prisma.notificationLog.count(),
    prisma.appNotification.count(),
    prisma.session.count(),
    prisma.account.count(),
    prisma.passwordResetToken.count()
  ]);

  return {
    accounts,
    appNotifications,
    assignments,
    notificationLogs,
    passwordResetTokens,
    replacementCensuses,
    scheduleWeeks,
    sessions,
    users,
    volunteerProfiles
  };
}

async function main() {
  const before = await getCounts();

  const deleted = await prisma.$transaction(async (tx) => {
    const scheduleWeeks = await tx.scheduleWeek.deleteMany({});
    const users = await tx.user.deleteMany({});

    return {
      scheduleWeeks: scheduleWeeks.count,
      users: users.count
    };
  });

  const after = await getCounts();

  console.log(
    JSON.stringify(
      {
        after,
        before,
        deleted,
        status: "wiped-production-users"
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
