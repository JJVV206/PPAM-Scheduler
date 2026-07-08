import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    appNotification: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    user: {
      findMany: vi.fn()
    },
    volunteerProfile: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));

import {
  createAppNotificationOnce,
  dismissAdminAttentionNotification,
  getUnreadAppNotificationCount,
  getUnreadAdminAttentionNotificationReferencesForUser,
  markAppNotificationRead
} from "@/services/app-notification.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("app notification service", () => {
  it("creates one app notification per dedupe key", async () => {
    mocks.db.appNotification.findFirst.mockResolvedValue(null);
    mocks.db.appNotification.create.mockResolvedValue({
      id: "app-notification-1"
    });

    await createAppNotificationOnce({
      userId: "user-1",
      assignmentId: "assignment-1",
      type: "ASSIGNMENT_PENDING",
      priority: "NORMAL",
      title: "Asignación pendiente",
      body: "Confirma tu asignación.",
      dedupeKey: "assignment-pending:invitation-1",
      metadata: {
        keep: "value",
        skip: undefined
      }
    });

    expect(mocks.db.appNotification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          type: "ASSIGNMENT_PENDING",
          metadata: {
            path: ["dedupeKey"],
            equals: "assignment-pending:invitation-1"
          }
        })
      })
    );
    expect(mocks.db.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          assignmentId: "assignment-1",
          metadata: {
            keep: "value",
            dedupeKey: "assignment-pending:invitation-1"
          }
        })
      })
    );
  });

  it("skips duplicate app notifications", async () => {
    mocks.db.appNotification.findFirst.mockResolvedValue({
      id: "app-notification-1"
    });

    const result = await createAppNotificationOnce({
      userId: "user-1",
      type: "CENSUS_PENDING",
      title: "Censo pendiente",
      body: "Responde el censo.",
      dedupeKey: "census:census-1"
    });

    expect(result).toBeNull();
    expect(mocks.db.appNotification.create).not.toHaveBeenCalled();
  });

  it("counts and marks only the current user's unread notifications", async () => {
    mocks.db.appNotification.count.mockResolvedValue(3);
    mocks.db.appNotification.updateMany.mockResolvedValue({ count: 1 });

    await expect(getUnreadAppNotificationCount("user-1")).resolves.toBe(3);
    await markAppNotificationRead({
      userId: "user-1",
      notificationId: "notification-1",
      readAt: new Date("2026-06-16T12:00:00.000Z")
    });

    expect(mocks.db.appNotification.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        readAt: null
      }
    });
    expect(mocks.db.appNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "notification-1",
        userId: "user-1",
        readAt: null
      },
      data: {
        readAt: new Date("2026-06-16T12:00:00.000Z")
      }
    });
  });

  it("deletes admin attention alerts by marking only owned unread admin alerts as read", async () => {
    const readAt = new Date("2026-06-17T13:00:00.000Z");
    mocks.db.appNotification.updateMany.mockResolvedValue({ count: 1 });

    await dismissAdminAttentionNotification({
      userId: "admin-1",
      notificationId: "notification-1",
      readAt
    });

    expect(mocks.db.appNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "notification-1",
        userId: "admin-1",
        type: {
          in: [
            "ADMIN_ATTENTION_REQUIRED",
            "EMAIL_FAILED",
            "REPLACEMENT_NEEDED"
          ]
        },
        readAt: null
      },
      data: {
        readAt
      }
    });
  });

  it("returns only unread admin attention notification references", async () => {
    mocks.db.appNotification.findMany.mockResolvedValue([
      { id: "attention-1", assignmentId: "assignment-1" },
      { id: "replacement-1", assignmentId: null }
    ]);

    await expect(
      getUnreadAdminAttentionNotificationReferencesForUser({
        userId: "admin-1"
      })
    ).resolves.toEqual([
      { id: "attention-1", assignmentId: "assignment-1" },
      { id: "replacement-1", assignmentId: null }
    ]);

    expect(mocks.db.appNotification.findMany).toHaveBeenCalledWith({
      where: {
        userId: "admin-1",
        readAt: null,
        type: {
          in: [
            "ADMIN_ATTENTION_REQUIRED",
            "EMAIL_FAILED",
            "REPLACEMENT_NEEDED"
          ]
        }
      },
      select: {
        id: true,
        assignmentId: true
      }
    });
  });
});
