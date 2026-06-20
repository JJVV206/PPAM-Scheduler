import { Prisma } from "@prisma/client";
import type {
  AppNotificationPriority,
  AppNotificationType,
  DayOfWeek,
  TimeSlot
} from "@prisma/client";

import { db } from "@/lib/db/prisma";
import {
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS
} from "@/lib/constants/domain";
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";
import { formatDisplayDate } from "@/lib/utils";
import { compactJsonMetadata } from "@/lib/utils/safe-metadata";

type AppNotificationClient = Prisma.TransactionClient | typeof db;

type AdminRecipient = {
  id: string;
};

type AssignmentSummary = {
  date: Date;
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlot;
};

const ADMIN_ATTENTION_NOTIFICATION_TYPES: AppNotificationType[] = [
  "ADMIN_ATTENTION_REQUIRED",
  "EMAIL_FAILED",
  "REPLACEMENT_NEEDED"
];

function assignmentDateLabel(assignment: AssignmentSummary) {
  return `${DAY_LABELS[assignment.dayOfWeek]}, ${formatDisplayDate(
    assignment.date,
    "d 'de' MMMM 'de' yyyy"
  )}`;
}

function assignmentTimeSlotLabel(assignment: Pick<AssignmentSummary, "timeSlot">) {
  return TIME_SLOT_DEFINITIONS[assignment.timeSlot].label;
}

async function getVolunteerUserId(input: {
  client: AppNotificationClient;
  volunteerProfileId: string;
}) {
  const volunteer = await input.client.volunteerProfile.findUnique({
    where: {
      id: input.volunteerProfileId
    },
    select: {
      userId: true
    }
  });

  return volunteer?.userId ?? null;
}

export async function createAppNotificationOnce(input: {
  client?: AppNotificationClient;
  userId: string;
  assignmentId?: string;
  censusId?: string;
  type: AppNotificationType;
  priority?: AppNotificationPriority;
  title: string;
  body: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}) {
  const client = input.client ?? db;
  const where: Prisma.AppNotificationWhereInput = {
    userId: input.userId,
    type: input.type
  };

  if (input.dedupeKey) {
    where.metadata = {
      path: ["dedupeKey"],
      equals: input.dedupeKey
    };
  } else {
    if (input.assignmentId) {
      where.assignmentId = input.assignmentId;
    }

    if (input.censusId) {
      where.censusId = input.censusId;
    }
  }

  const existing = await client.appNotification.findFirst({
    where,
    select: {
      id: true
    }
  });

  if (existing) {
    return null;
  }

  return client.appNotification.create({
    data: {
      userId: input.userId,
      assignmentId: input.assignmentId,
      censusId: input.censusId,
      type: input.type,
      priority: input.priority ?? "NORMAL",
      title: input.title,
      body: input.body,
      metadata: compactJsonMetadata({
        ...(input.metadata ?? {}),
        dedupeKey: input.dedupeKey
      })
    }
  });
}

export async function createVolunteerAssignmentConfirmedAppNotification(input: {
  client?: AppNotificationClient;
  volunteerProfileId: string;
  assignmentId: string;
  assignment: AssignmentSummary;
  source: string;
  invitationId?: string;
  invitationType?: string;
}) {
  const client = input.client ?? db;
  const userId = await getVolunteerUserId({
    client,
    volunteerProfileId: input.volunteerProfileId
  });

  if (!userId) {
    return null;
  }

  const dateLabel = assignmentDateLabel(input.assignment);
  const timeSlotLabel = assignmentTimeSlotLabel(input.assignment);

  return createAppNotificationOnce({
    client,
    userId,
    assignmentId: input.assignmentId,
    type: "ASSIGNMENT_CONFIRMED",
    priority: "NORMAL",
    title: "Asignación confirmada",
    body: `Tu asignación para ${dateLabel}, ${timeSlotLabel}, quedó confirmada.`,
    dedupeKey: `assignment-confirmed:${input.assignmentId}:${input.volunteerProfileId}`,
    metadata: {
      source: input.source,
      invitationId: input.invitationId,
      invitationType: input.invitationType,
      volunteerProfileId: input.volunteerProfileId,
      date: input.assignment.date.toISOString(),
      dayOfWeek: input.assignment.dayOfWeek,
      timeSlot: input.assignment.timeSlot,
      pointName: FIXED_PREACHING_POINT_NAME
    }
  });
}

export async function markAssignmentPendingAppNotificationsRead(input: {
  client?: AppNotificationClient;
  assignmentId: string;
  volunteerProfileId: string;
  readAt?: Date;
}) {
  const client = input.client ?? db;
  const userId = await getVolunteerUserId({
    client,
    volunteerProfileId: input.volunteerProfileId
  });

  if (!userId) {
    return { count: 0 };
  }

  return client.appNotification.updateMany({
    where: {
      userId,
      assignmentId: input.assignmentId,
      type: "ASSIGNMENT_PENDING",
      readAt: null
    },
    data: {
      readAt: input.readAt ?? new Date()
    }
  });
}

export async function createAdminAppNotifications(input: {
  client?: AppNotificationClient;
  admins?: AdminRecipient[];
  assignmentId?: string;
  censusId?: string;
  type: Extract<
    AppNotificationType,
    "ADMIN_ATTENTION_REQUIRED" | "EMAIL_FAILED" | "REPLACEMENT_NEEDED"
  >;
  priority?: Extract<AppNotificationPriority, "HIGH" | "URGENT">;
  title: string;
  body: string;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
}) {
  const client = input.client ?? db;
  const admins =
    input.admins ??
    (await client.user.findMany({
      where: {
        role: "ADMIN",
        active: true,
        accessStatus: "APPROVED"
      },
      select: {
        id: true
      }
    }));

  const notifications = await Promise.all(
    admins.map((admin) =>
      createAppNotificationOnce({
        client,
        userId: admin.id,
        assignmentId: input.assignmentId,
        censusId: input.censusId,
        type: input.type,
        priority: input.priority ?? "URGENT",
        title: input.title,
        body: input.body,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata
      })
    )
  );

  return notifications.filter(Boolean);
}

export async function createAdminAssignmentAppNotifications(input: Omit<
  Parameters<typeof createAdminAppNotifications>[0],
  "assignmentId"
> & {
  assignmentId: string;
}) {
  return createAdminAppNotifications(input);
}

export async function getUnreadAppNotificationCount(userId: string) {
  return db.appNotification.count({
    where: {
      userId,
      readAt: null
    }
  });
}

const appNotificationInclude = {
  assignment: {
    select: {
      id: true,
      date: true,
      dayOfWeek: true,
      timeSlot: true,
      pairNumber: true,
      preachingPoint: {
        select: {
          name: true
        }
      }
    }
  },
  census: {
    select: {
      id: true,
      closesAt: true,
      scheduleWeek: {
        select: {
          startDate: true,
          endDate: true
        }
      }
    }
  }
} satisfies Prisma.AppNotificationInclude;

export async function getAppNotificationsForUser(input: {
  userId: string;
  take?: number;
}) {
  const take = input.take ?? 50;
  const unread = await db.appNotification.findMany({
    where: {
      userId: input.userId,
      readAt: null
    },
    include: appNotificationInclude,
    orderBy: {
      createdAt: "desc"
    },
    take
  });
  const remaining = Math.max(take - unread.length, 0);

  if (!remaining) {
    return unread;
  }

  const read = await db.appNotification.findMany({
    where: {
      userId: input.userId,
      readAt: {
        not: null
      }
    },
    include: appNotificationInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: remaining
  });

  return [...unread, ...read];
}

export type AppNotificationListItem = Awaited<
  ReturnType<typeof getAppNotificationsForUser>
>[number];

export async function getUnreadCriticalAppNotificationsForUser(input: {
  userId: string;
  take?: number;
}) {
  return db.appNotification.findMany({
    where: {
      userId: input.userId,
      readAt: null,
      type: {
        in: ADMIN_ATTENTION_NOTIFICATION_TYPES
      },
      priority: {
        in: ["HIGH", "URGENT"]
      }
    },
    include: appNotificationInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: input.take ?? 6
  });
}

export async function getUnreadAdminAttentionNotificationsForUser(input: {
  userId: string;
  take?: number;
}) {
  return db.appNotification.findMany({
    where: {
      userId: input.userId,
      readAt: null,
      type: {
        in: ADMIN_ATTENTION_NOTIFICATION_TYPES
      }
    },
    include: appNotificationInclude,
    orderBy: [
      {
        priority: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    take: input.take ?? 50
  });
}

export async function markAppNotificationRead(input: {
  userId: string;
  notificationId: string;
  readAt?: Date;
}) {
  return db.appNotification.updateMany({
    where: {
      id: input.notificationId,
      userId: input.userId,
      readAt: null
    },
    data: {
      readAt: input.readAt ?? new Date()
    }
  });
}

export async function markAllAppNotificationsRead(input: {
  userId: string;
  readAt?: Date;
}) {
  return db.appNotification.updateMany({
    where: {
      userId: input.userId,
      readAt: null
    },
    data: {
      readAt: input.readAt ?? new Date()
    }
  });
}
