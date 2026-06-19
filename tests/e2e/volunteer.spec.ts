import { expect, test, type APIRequestContext } from "@playwright/test";

import { expectNoHorizontalOverflow, expectStatus } from "./support/assertions";
import { e2eAssignmentNotes } from "./support/fixtures";

type VolunteerDashboardAssignment = {
  id: string;
  notes: string | null;
};

type VolunteerDashboardResponse = {
  pendingConfirmations: VolunteerDashboardAssignment[];
  upcomingAssignments: VolunteerDashboardAssignment[];
};

async function getVolunteerAssignmentIdByNote(
  request: APIRequestContext,
  note: string
) {
  const response = await request.get("/api/dashboard/volunteer");

  await expectStatus(response, 200);

  const dashboard = (await response.json()) as VolunteerDashboardResponse;
  const assignments = [
    ...dashboard.pendingConfirmations,
    ...dashboard.upcomingAssignments
  ];
  const assignment = assignments.find((item) => item.notes === note);

  expect(assignment, `Expected E2E volunteer assignment "${note}"`).toBeTruthy();
  return assignment!.id;
}

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
    await expectNoHorizontalOverflow(page);
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

  test("shows pending assignment actions and opens assignment detail", async ({
    page,
    request
  }) => {
    const assignmentId = await getVolunteerAssignmentIdByNote(
      request,
      e2eAssignmentNotes.volunteerPending
    );

    await page.goto("/volunteer/assignments");

    await expect(
      page.getByRole("heading", { name: /pendientes de respuesta/i })
    ).toBeVisible();
    await expect(page.getByText(/necesita respuesta/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^confirmar$/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /no puedo asistir/i }).first()
    ).toBeVisible();

    await page.goto(`/volunteer/assignments/${assignmentId}`);

    await expect(
      page.getByRole("heading", { name: /hospital dr josé g\. parres/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^confirmar$/i })
    ).toBeVisible();
  });
});
