import { expect, test, type APIRequestContext } from "@playwright/test";

import { expectNoHorizontalOverflow, expectStatus } from "./support/assertions";
import { e2eUsers } from "./support/config";
import { e2eAssignmentFixtures, e2eAssignmentNotes } from "./support/fixtures";
import {
  clearMailpitInbox,
  getMailpitMessageDetail,
  waitForMailpitMessage
} from "./support/mailpit";

type AssignmentApiItem = {
  id: string;
  notes: string | null;
};

async function getAssignmentIdByNote(
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

test.describe("admin workspace", () => {
  test("loads the admin dashboard and primary navigation", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: /cobertura semanal/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /censo de suplentes/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^alertas$/i })
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

  test("opens a full assignment detail page from the assignments list", async ({
    page
  }) => {
    test.slow();

    await page.goto("/admin/assignments");

    const detailLink = page.locator('a[href^="/admin/assignments/"]').first();

    await expect(detailLink).toBeVisible();
    const detailHref = await detailLink.getAttribute("href");

    expect(detailHref).toMatch(/^\/admin\/assignments\/[^/]+$/);

    await Promise.all([
      page.waitForURL(new RegExp(`${detailHref}$`), { timeout: 30_000 }),
      detailLink.click()
    ]);

    await expect(page).toHaveURL(/\/admin\/assignments\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: /hospital dr josé g\. parres/i })
    ).toBeVisible();
    await expect(page.getByText(/proceso automático/i)).toBeVisible();
  });

  test("keeps the weekly schedule accessible without page overflow", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/schedule");

    await expect(
      page.getByRole("grid", { name: /horario semanal de lunes a domingo/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /abrir horario de/i }).first()
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("sends an assignment invitation email through Mailpit", async ({
    page,
    request
  }) => {
    test.slow();

    await clearMailpitInbox(request);
    const assignmentId = await getAssignmentIdByNote(
      request,
      e2eAssignmentNotes.emailFlow
    );
    const sentAfter = new Date();

    await page.goto(`/admin/assignments/${assignmentId}`);
    await expect(
      page.getByRole("heading", { name: /hospital dr josé g\. parres/i })
    ).toBeVisible();

    await page
      .getByRole("button", { name: /enviar invitación pendiente/i })
      .click();

    await expect(
      page.getByText(/invitaciones pendientes enviadas \(1\)/i)
    ).toBeVisible();

    const message = await waitForMailpitMessage(request, {
      subject: "Confirma tu asignación titular de PPAM",
      to: e2eUsers.volunteer.email,
      createdAfter: sentAfter
    });
    const detail = await getMailpitMessageDetail(request, message.ID);
    const body = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`;

    expect(body).toContain(
      `/confirm-assignment/${e2eAssignmentFixtures.emailInvitationToken}`
    );
  });
});
