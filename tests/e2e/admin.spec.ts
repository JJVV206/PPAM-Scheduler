import type { Page } from "@playwright/test";

import { expectNoHorizontalOverflow, expectStatus } from "./support/assertions";
import { e2eUsers } from "./support/config";
import { getAdminAssignmentIdByNote } from "./support/pages/admin-assignments-page";
import { expect, test } from "./support/test";

async function gotoAdminPageWithoutServerError(page: Page, path: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await page.goto(path, {
        waitUntil: "domcontentloaded"
      });

      expect(response?.status()).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/login$/);
      await expect(page.locator("body")).toBeVisible();
      return;
    } catch (error) {
      lastError = error;

      if (!String(error).includes("ERR_ABORTED")) {
        throw error;
      }
    }
  }

  throw lastError;
}

test.describe("admin workspace", () => {
  test("loads the admin dashboard and primary navigation @smoke", async ({
    page
  }) => {
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

  test("serves critical admin APIs and enforces role isolation @critical", async ({
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

  test("can open core admin pages without server errors @smoke", async ({
    page
  }) => {
    test.slow();

    const pages = [
      "/admin/schedule",
      "/admin/assignments",
      "/admin/open-slots",
      "/admin/notifications",
      "/admin/points",
      "/admin/replacements",
      "/admin/volunteers",
      "/admin/settings"
    ];

    for (const path of pages) {
      await gotoAdminPageWithoutServerError(page, path);
    }
  });

  test("keeps admissions pending-only and exposes rejected history @critical @write", async ({
    e2eData,
    page
  }) => {
    await page.goto("/admin/volunteers");

    const admissionRegion = page.getByRole("region", {
      name: /solicitudes pendientes de admisión/i
    });
    const usersRegion = page.getByRole("region", {
      name: /directorio de usuarios/i
    });
    const pendingName = e2eData.admissions.pendingName;
    const rejectedName = e2eData.admissions.rejectedName;

    await expect(admissionRegion.getByText(pendingName)).toBeVisible();
    await expect(admissionRegion.getByText(rejectedName)).toHaveCount(0);
    await expect(usersRegion.getByText(rejectedName)).toHaveCount(0);

    const pendingRow = admissionRegion
      .getByRole("row")
      .filter({ hasText: pendingName });
    await pendingRow.getByRole("button", { name: "Rechazar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Rechazar" })
      .click();

    await expect(admissionRegion.getByText(pendingName)).toHaveCount(0);

    await usersRegion.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Rechazada" }).click();

    await expect(usersRegion.getByText(pendingName)).toBeVisible();
    await expect(usersRegion.getByText(rejectedName)).toBeVisible();
  });

  test("opens a full assignment detail page from the assignments list @critical", async ({
    adminAssignmentsPage,
    page
  }) => {
    test.slow();

    await adminAssignmentsPage.gotoList();
    await adminAssignmentsPage.openFirstDetail();

    await expect(page).toHaveURL(/\/admin\/assignments\/[^/]+$/);
    await adminAssignmentsPage.expectHospitalDetailLoaded();
    await expect(page.getByText(/proceso automático/i)).toBeVisible();
  });

  test("keeps the weekly schedule accessible without page overflow @responsive", async ({
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

  test("restricts assignment candidates to volunteer availability @critical @write @email", async ({
    page,
    request
  }) => {
    await page.goto("/admin/schedule/2026-07-20/SLOT_11_13");
    await page
      .getByRole("button", { name: /agregar pareja a este horario/i })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const firstMemberSelect = dialog.getByRole("combobox").first();
    await firstMemberSelect.click();
    await expect(
      page.getByRole("option", { name: "E2E Volunteer", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "E2E Replacement", exact: true })
    ).toHaveCount(0);
    await page
      .getByRole("option", { name: "E2E Volunteer", exact: true })
      .click();

    await dialog
      .getByPlaceholder("Indicaciones opcionales para esta pareja")
      .fill("E2E availability assignment");
    await dialog.getByRole("button", { name: "Guardar pareja" }).click();
    await expect(page.getByText(/Pareja \d+ creada/)).toBeVisible();

    await page.goto("/admin/schedule/2026-07-20/SLOT_07_09");
    await page
      .getByRole("button", { name: /agregar pareja a este horario/i })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByText("No hay voluntarios disponibles para este horario.")
    ).toBeVisible();

    const assignmentsResponse = await request.get("/api/assignments");
    const assignments = (await assignmentsResponse.json()) as Array<{
      preachingPoint: { id: string };
      scheduleWeekId: string;
    }>;
    const volunteersResponse = await request.get("/api/volunteers");
    const volunteers = (await volunteersResponse.json()) as Array<{
      id: string;
      name: string;
    }>;
    const volunteer = volunteers.find((item) => item.name === "E2E Volunteer");
    expect(volunteer).toBeTruthy();

    const manipulatedResponse = await request.post("/api/assignments", {
      data: {
        scheduleWeekId: assignments[0].scheduleWeekId,
        date: "2026-07-26T12:00:00.000Z",
        dayOfWeek: "SUNDAY",
        timeSlot: "SLOT_07_09",
        preachingPointId: assignments[0].preachingPoint.id,
        volunteers: [{ volunteerId: volunteer!.id, slotNumber: 1 }]
      }
    });
    const manipulatedBody = await manipulatedResponse.json();

    expect(manipulatedResponse.status()).toBe(409);
    expect(manipulatedBody.error).toMatch(/disponibilidad/i);
  });

  test("sends an assignment invitation email through Mailpit @critical @write @email", async ({
    adminAssignmentsPage,
    e2eData,
    mailpit,
    page,
    request
  }) => {
    test.slow();

    await mailpit.clearInbox(request);
    const assignmentId = await getAdminAssignmentIdByNote(
      request,
      e2eData.notes.emailFlow
    );
    const sentAfter = new Date();

    await adminAssignmentsPage.gotoDetail(assignmentId);
    await adminAssignmentsPage.expectHospitalDetailLoaded();

    await adminAssignmentsPage.sendPendingInvitation();

    await expect(
      page.getByText(/invitaciones pendientes enviadas \(1\)/i)
    ).toBeVisible();

    const message = await mailpit.waitForMessage(request, {
      subject: "Confirma tu asignación titular de PPAM",
      to: e2eUsers.volunteer.email,
      createdAfter: sentAfter
    });
    const detail = await mailpit.getMessageDetail(request, message.ID);
    const body = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`;

    expect(body).toContain(
      `/confirm-assignment/${e2eData.fixtures.emailInvitationToken}`
    );
  });
});
