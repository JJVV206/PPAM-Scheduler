import { expect, test } from "@playwright/test";

import { expectStatus } from "./support/assertions";

test.describe("admin workspace", () => {
  test("loads the admin dashboard and primary navigation", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: /panel administrativo/i })
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", {
        name: /horario semanal/i
      })
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", {
        name: /atención requerida/i
      })
    ).toBeVisible();
  });

  test("serves critical admin APIs and enforces role isolation", async ({
    request
  }) => {
    const endpoints: Array<[string, number]> = [
      ["/api/dashboard/admin", 200],
      ["/api/settings", 200],
      ["/api/points", 200],
      ["/api/volunteers", 200],
      ["/api/schedule/week", 200],
      ["/api/dashboard/volunteer", 403]
    ];

    for (const [endpoint, status] of endpoints) {
      await expectStatus(await request.get(endpoint), status);
    }
  });

  test("can open core admin pages without server errors", async ({ page }) => {
    test.slow();

    const pages = [
      "/admin/schedule",
      "/admin/assignments",
      "/admin/open-slots",
      "/admin/volunteers",
      "/admin/settings"
    ];

    for (const path of pages) {
      const response = await page.goto(path, {
        waitUntil: "domcontentloaded"
      });

      expect(response?.status()).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/login$/);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
