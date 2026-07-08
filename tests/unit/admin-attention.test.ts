import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminDashboardStats: vi.fn(),
  getUnreadAdminAttentionNotificationReferencesForUser: vi.fn()
}));

vi.mock("@/services/dashboard.service", () => ({
  getAdminDashboardStats: mocks.getAdminDashboardStats
}));

vi.mock("@/services/app-notification.service", () => ({
  getUnreadAdminAttentionNotificationReferencesForUser:
    mocks.getUnreadAdminAttentionNotificationReferencesForUser
}));

import { getAdminAttentionCaseCountForUser } from "@/services/admin-attention.service";

describe("admin attention service", () => {
  it("counts visible attention cases without duplicating assignment notifications", async () => {
    mocks.getAdminDashboardStats.mockResolvedValue({
      requiresAttention: [
        { id: "assignment-1" },
        { id: "assignment-2" },
        { id: "assignment-3" }
      ]
    });
    mocks.getUnreadAdminAttentionNotificationReferencesForUser.mockResolvedValue([
      { id: "notification-1", assignmentId: "assignment-1" },
      { id: "notification-2", assignmentId: null }
    ]);

    await expect(
      getAdminAttentionCaseCountForUser({ userId: "admin-1" })
    ).resolves.toBe(4);

    expect(
      mocks.getUnreadAdminAttentionNotificationReferencesForUser
    ).toHaveBeenCalledWith({
      userId: "admin-1"
    });
  });
});
