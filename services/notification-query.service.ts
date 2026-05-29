import { db } from "@/lib/db/prisma";

export async function getNotificationHistory() {
  return db.notificationLog.findMany({
    include: {
      user: true,
      assignment: {
        include: {
          preachingPoint: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}
