import { expectNoHorizontalOverflow } from "./support/assertions";
import { expect, test } from "./support/test";

test.describe("mobile responsive smoke", () => {
  test("keeps primary admin pages usable on mobile viewport @smoke @responsive", async ({
    page
  }) => {
    test.slow();

    const pages = ["/admin", "/admin/schedule", "/admin/assignments"];

    for (const path of pages) {
      const response = await page.goto(path, {
        waitUntil: "domcontentloaded"
      });

      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("keeps critical admin pages stable on laptop viewport @responsive", async ({
    page
  }) => {
    test.slow();

    await page.setViewportSize({ width: 1366, height: 768 });

    for (const path of ["/admin", "/admin/schedule", "/admin/assignments"]) {
      const response = await page.goto(path, {
        waitUntil: "domcontentloaded"
      });

      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});
