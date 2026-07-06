import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { expectStatus } from "../assertions";

type AssignmentApiItem = {
  id: string;
  notes: string | null;
};

export class AdminAssignmentsPage {
  constructor(private readonly page: Page) {}

  async gotoList() {
    await this.page.goto("/admin/assignments");
  }

  async openFirstDetail() {
    const detailLink = this.page
      .locator('a[href^="/admin/assignments/"]')
      .first();

    await expect(detailLink).toBeVisible();
    const detailHref = await detailLink.getAttribute("href");

    expect(detailHref).toMatch(/^\/admin\/assignments\/[^/]+$/);
    await Promise.all([
      this.page.waitForURL(new RegExp(`${detailHref}$`), {
        timeout: 30_000
      }),
      detailLink.click()
    ]);

    return detailHref!;
  }

  async gotoDetail(assignmentId: string) {
    await this.page.goto(`/admin/assignments/${assignmentId}`);
  }

  async expectHospitalDetailLoaded() {
    await expect(
      this.page.getByRole("heading", { name: /hospital dr josé g\. parres/i })
    ).toBeVisible();
  }

  async sendPendingInvitation() {
    await this.page
      .getByRole("button", { name: /enviar invitación pendiente/i })
      .click();
  }
}

export async function getAdminAssignmentIdByNote(
  request: APIRequestContext,
  note: string
) {
  const response = await request.get("/api/assignments");

  await expectStatus(response, 200);

  const assignments = (await response.json()) as AssignmentApiItem[];
  const assignment = assignments.find((item) => item.notes === note);

  expect(assignment, `Expected E2E assignment with note "${note}"`).toBeTruthy();
  return assignment!.id;
}
