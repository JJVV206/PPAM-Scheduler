import { expect, type Page } from "@playwright/test";

export class VolunteerAssignmentsPage {
  constructor(private readonly page: Page) {}

  async gotoList() {
    await this.page.goto("/volunteer/assignments");
  }

  async expectPendingActions() {
    await expect(
      this.page.getByRole("heading", { name: /pendientes de respuesta/i })
    ).toBeVisible();
    await expect(this.page.getByText(/necesita respuesta/i).first()).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /^confirmar$/i }).first()
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /no puedo asistir/i }).first()
    ).toBeVisible();
  }

  async gotoDetail(assignmentId: string) {
    await this.page.goto(`/volunteer/assignments/${assignmentId}`);
  }

  async expectDetailActions() {
    await expect(
      this.page.getByRole("heading", { name: /hospital dr josé g\. parres/i })
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /^confirmar$/i })
    ).toBeVisible();
  }

  async confirmFromDetail() {
    await this.page.getByRole("button", { name: /^confirmar$/i }).click();
    await expect(this.page.getByText(/respuesta registrada/i)).toBeVisible();
    await expect(
      this.page.getByText(/confirmaste tu asistencia/i)
    ).toBeVisible();
  }
}
