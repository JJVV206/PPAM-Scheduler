import { expectStatus } from "./support/assertions";
import { e2eUsers } from "./support/config";
import { expect, test } from "./support/test";

test.describe("public and unauthenticated service checks", () => {
  test("loads login and redirects protected admin route to login @smoke @prod-safe", async ({
    page
  }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /bienvenido de nuevo/i })
    ).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("reports core health without requiring authentication @smoke @prod-safe", async ({
    request
  }) => {
    const response = await request.get("/api/health");
    await expectStatus(response, 200);

    const body = await response.json();
    expect(body.checks.appEnv).toBe("ok");
    expect(body.checks.database).toBe("ok");
    expect(["ok", "core_ok"]).toContain(body.status);
  });

  test("protects assignment automation cron without bearer secret @critical @prod-safe", async ({
    request
  }) => {
    const response = await request.get("/api/cron/assignment-automation");
    await expectStatus(response, 401);
  });

  test("shows safe public copy for an invalid assignment token @smoke @prod-safe", async ({
    page
  }) => {
    await page.goto("/confirm-assignment/not-a-real-token");

    await expect(
      page.getByRole("heading", { name: /invitación no encontrada/i })
    ).toBeVisible();
    await expect(page.getByText(/el enlace no es válido/i)).toBeVisible();
  });

  test("lets a volunteer confirm from a public assignment invitation link @critical @write", async ({
    e2eData,
    publicConfirmationPage
  }) => {
    await publicConfirmationPage.gotoToken(
      e2eData.fixtures.publicConfirmationToken
    );

    await publicConfirmationPage.expectReady();
    await publicConfirmationPage.confirm();

    await publicConfirmationPage.expectRegistered(/confirmaste tu asistencia/i);
  });

  test("lets a volunteer decline and invites an eligible replacement through Mailpit @critical @write @email", async ({
    e2eData,
    mailpit,
    publicConfirmationPage,
    request
  }) => {
    await mailpit.clearInbox(request);
    const sentAfter = new Date();

    await publicConfirmationPage.gotoToken(e2eData.fixtures.publicDeclineToken);
    await publicConfirmationPage.expectReady();
    await publicConfirmationPage.decline();

    await publicConfirmationPage.expectRegistered(/no puedes asistir/i);

    const message = await mailpit.waitForMessage(request, {
      subject: "Invitación para cubrir como suplente en PPAM",
      to: e2eUsers.replacement.email,
      createdAfter: sentAfter
    });
    const detail = await mailpit.getMessageDetail(request, message.ID);
    const body = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`;

    expect(body).toContain("/confirm-assignment/");
    expect(body).toContain("suplente");
  });

  test("shows expired and already-responded public invitation states @critical", async ({
    e2eData,
    publicConfirmationPage
  }) => {
    await publicConfirmationPage.gotoToken(e2eData.fixtures.publicExpiredToken);
    await publicConfirmationPage.expectUnavailable(
      /invitación expirada/i,
      /tiempo para responder/i
    );

    await publicConfirmationPage.gotoToken(
      e2eData.fixtures.publicRespondedToken
    );
    await publicConfirmationPage.expectUnavailable(
      /respuesta registrada/i,
      /ya fue respondida/i
    );
  });
});
