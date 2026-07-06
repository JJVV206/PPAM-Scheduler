import { expectStatus } from "./support/assertions";
import { expect, test } from "./support/test";

test.describe("production-safe read-only smoke", () => {
  test("checks public health, login and protected redirect @prod-safe", async ({
    page,
    request
  }) => {
    const health = await request.get("/api/health");

    await expectStatus(health, 200);
    const body = await health.json();

    expect(body.checks.appEnv).toBe("ok");
    expect(["ok", "core_ok"]).toContain(body.status);

    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /bienvenido de nuevo/i })
    ).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("confirms cron remains protected without a bearer secret @prod-safe", async ({
    request
  }) => {
    const response = await request.get("/api/cron/assignment-automation");

    await expectStatus(response, 401);
  });
});
