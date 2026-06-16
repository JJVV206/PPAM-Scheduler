import { describe, expect, it } from "vitest";

import {
  notifyAdminsForUnresolvedAssignments,
  sendDueAssignmentReminders
} from "@/services/assignment-automation.service";

describe("assignment automation deferred steps", () => {
  it("returns explicit skipped results for module-scoped future steps", async () => {
    await expect(sendDueAssignmentReminders()).resolves.toMatchObject({
      status: "skipped",
      processedCount: 0
    });
    await expect(notifyAdminsForUnresolvedAssignments()).resolves.toMatchObject({
      status: "skipped",
      processedCount: 0
    });
  });
});
