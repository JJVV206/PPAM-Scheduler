import { expect, type Page } from "@playwright/test";

export class PublicConfirmationPage {
  constructor(private readonly page: Page) {}

  async gotoToken(token: string) {
    await this.page.goto(`/confirm-assignment/${token}`);
  }

  async expectReady() {
    await expect(
      this.page.getByRole("heading", { name: /confirma tu asistencia/i })
    ).toBeVisible();
    await expect(
      this.page.getByText(/hospital dr josé g\. parres/i)
    ).toBeVisible();
  }

  async confirm() {
    await this.page.getByRole("button", { name: /^confirmar$/i }).click();
  }

  async decline() {
    await this.page
      .getByRole("button", { name: /no puedo asistir/i })
      .click();
  }

  async expectRegistered(copy: RegExp) {
    await expect(this.page.getByText(/respuesta registrada/i)).toBeVisible();
    await expect(this.page.getByText(copy).first()).toBeVisible();
  }

  async expectUnavailable(title: RegExp, body?: RegExp) {
    await expect(this.page.getByRole("heading", { name: title })).toBeVisible();

    if (body) {
      await expect(this.page.getByText(body)).toBeVisible();
    }
  }
}
