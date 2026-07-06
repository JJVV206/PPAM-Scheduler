import { expectStatus } from "./support/assertions";
import { expect, test } from "./support/test";

const cronSecret =
  process.env.CRON_SECRET ?? "ppam-e2e-local-cron-secret-change-outside-tests";

test.describe("critical service regression", () => {
  test("serves the critical authenticated admin API matrix @critical", async ({
    request
  }) => {
    const endpoints: Array<[string, number]> = [
      ["/api/dashboard/admin", 200],
      ["/api/settings", 200],
      ["/api/points", 200],
      ["/api/volunteers", 200],
      ["/api/assignments", 200],
      ["/api/open-slots", 200],
      ["/api/schedule/week", 200],
      ["/api/dashboard/volunteer", 403]
    ];

    for (const [endpoint, status] of endpoints) {
      await expectStatus(await request.get(endpoint), status);
    }
  });

  test("runs assignment automation cron with bearer secret @critical @write @email", async ({
    request
  }) => {
    const response = await request.get("/api/cron/assignment-automation", {
      headers: {
        Authorization: `Bearer ${cronSecret}`
      }
    });

    await expectStatus(response, 200);

    const body = await response.json();
    expect(body.status).toBe("completed");
    expect(body.automationRunId).toEqual(expect.any(String));
    expect(body.failedStepCount).toEqual(expect.any(Number));
  });
});
