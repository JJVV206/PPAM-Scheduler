import { expect, type APIResponse, type Page } from "@playwright/test";

export async function expectStatus(
  response: APIResponse,
  expectedStatus: number
) {
  const body = await response.text();
  expect(response.status(), body).toBe(expectedStatus);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

