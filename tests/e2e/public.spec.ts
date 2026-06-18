import { expect, test } from "@playwright/test";

import { expectStatus } from "./support/assertions";
import { e2eAssignmentFixtures } from "./support/fixtures";

test.describe("public and unauthenticated service checks", () => {
  test("loads login and redirects protected admin route to login", async ({
    page
  }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /bienvenido de nuevo/i })
    ).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("reports core health without requiring authentication", async ({
    request
  }) => {
    const response = await request.get("/api/health");
    await expectStatus(response, 200);

    const body = await response.json();
    expect(body.checks.appEnv).toBe("ok");
    expect(body.checks.database).toBe("ok");
    expect(["ok", "core_ok"]).toContain(body.status);
  });

  test("protects assignment automation cron without bearer secret", async ({
    request
  }) => {
    const response = await request.get("/api/cron/assignment-automation");
    await expectStatus(response, 401);
  });

  test("shows safe public copy for an invalid assignment token", async ({
    page
  }) => {
    await page.goto("/confirm-assignment/not-a-real-token");

    await expect(
      page.getByRole("heading", { name: /invitación no encontrada/i })
    ).toBeVisible();
    await expect(page.getByText(/el enlace no es válido/i)).toBeVisible();
  });

  test("lets a volunteer confirm from a public assignment invitation link", async ({
    page
  }) => {
    await page.goto(
      `/confirm-assignment/${e2eAssignmentFixtures.publicConfirmationToken}`
    );

    await expect(
      page.getByRole("heading", { name: /confirma tu asistencia/i })
    ).toBeVisible();
    await expect(page.getByText(/hospital dr josé g\. parres/i)).toBeVisible();

    await page.getByRole("button", { name: /^confirmar$/i }).click();

    await expect(page.getByText(/respuesta registrada/i)).toBeVisible();
    await expect(
      page.getByText(/confirmaste tu asistencia/i)
    ).toBeVisible();
  });
});
