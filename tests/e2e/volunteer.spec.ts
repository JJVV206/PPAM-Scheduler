import { expect, test } from "@playwright/test";

import { expectStatus } from "./support/assertions";

test.describe("volunteer workspace", () => {
  test("loads volunteer dashboard and key self-service actions", async ({
    page
  }) => {
    await page.goto("/volunteer");

    await expect(page.getByText(/^Hola,/i)).toBeVisible();
    await expect(page.getByText(/vacantes para ti/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /actualizar disponibilidad/i })
    ).toBeVisible();
  });

  test("serves volunteer APIs and blocks admin APIs", async ({ request }) => {
    const endpoints: Array<[string, number]> = [
      ["/api/dashboard/volunteer", 200],
      ["/api/open-slots", 200],
      ["/api/dashboard/admin", 403],
      ["/api/settings", 403],
      ["/api/volunteers", 403]
    ];

    for (const [endpoint, status] of endpoints) {
      await expectStatus(await request.get(endpoint), status);
    }
  });

  test("redirects volunteers away from admin routes", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/volunteer$/);
  });

  test("can open core volunteer pages without server errors", async ({
    page
  }) => {
    test.slow();

    const pages = [
      "/volunteer/assignments",
      "/volunteer/availability",
      "/volunteer/open-slots",
      "/volunteer/profile"
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
