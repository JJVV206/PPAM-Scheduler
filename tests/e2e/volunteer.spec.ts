import type { APIRequestContext } from "@playwright/test";

import { expectNoHorizontalOverflow, expectStatus } from "./support/assertions";
import { expect, test } from "./support/test";

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

  expect(
    assignment,
    `Expected E2E volunteer assignment "${note}"`
  ).toBeTruthy();
  return assignment!.id;
}

test.describe("volunteer workspace", () => {
  test("loads volunteer dashboard and key self-service actions @smoke", async ({
    page
  }) => {
    await page.goto("/volunteer");

    await expect(page.getByText(/^Hola,/i)).toBeVisible();
    await expect(page.getByText(/suplencias disponibles/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Suplencias$/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /actualizar disponibilidad/i })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("serves volunteer APIs and blocks admin APIs @critical", async ({
    request
  }) => {
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

  test("redirects volunteers away from admin routes @critical", async ({
    page
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/volunteer$/);
  });

  test("can open core volunteer pages without server errors @smoke", async ({
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

  test("saves volunteer availability through authenticated API @critical @write", async ({
    page,
    request
  }) => {
    const response = await request.put("/api/availability", {
      data: {
        items: [
          {
            dayOfWeek: "MONDAY",
            timeSlot: "SLOT_09_11",
            available: true,
            recurring: true
          },
          {
            dayOfWeek: "FRIDAY",
            timeSlot: "SLOT_09_11",
            available: true,
            recurring: true
          }
        ],
        temporaryUnavailable: false
      }
    });

    await expectStatus(response, 200);

    await page.goto("/volunteer/availability");
    await expect(page.getByText(/2 horarios marcados/i)).toBeVisible();
  });

  test("shows pending assignment actions and opens assignment detail @critical", async ({
    e2eData,
    request,
    volunteerAssignmentsPage
  }) => {
    const assignmentId = await getVolunteerAssignmentIdByNote(
      request,
      e2eData.notes.volunteerPending
    );

    await volunteerAssignmentsPage.gotoList();
    await volunteerAssignmentsPage.expectPendingActions();

    await volunteerAssignmentsPage.gotoDetail(assignmentId);
    await volunteerAssignmentsPage.expectDetailActions();
  });

  test("confirms an assignment from the authenticated volunteer detail @critical @write", async ({
    e2eData,
    request,
    volunteerAssignmentsPage
  }) => {
    const assignmentId = await getVolunteerAssignmentIdByNote(
      request,
      e2eData.notes.volunteerAuthConfirm
    );

    await volunteerAssignmentsPage.gotoDetail(assignmentId);
    await volunteerAssignmentsPage.expectDetailActions();
    await volunteerAssignmentsPage.confirmFromDetail();
  });
});
