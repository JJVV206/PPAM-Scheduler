import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./support/assertions";

test.describe("mobile responsive smoke", () => {
  test("keeps primary admin pages usable on mobile viewport", async ({
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
});
