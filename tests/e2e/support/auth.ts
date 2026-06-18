import { expect, type Page } from "@playwright/test";

type LoginUser = {
  email: string;
  password: string;
  homePath: string;
};

export async function loginViaUi(page: Page, user: LoginUser) {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /bienvenido de nuevo/i })
  ).toBeVisible();

  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/contraseña/i).fill(user.password);
  await page.getByRole("button", { name: /^entrar$/i }).click();

  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto(user.homePath);
  await expect(page).toHaveURL(new RegExp(`${user.homePath}$`));
}

export async function logout(page: Page) {
  await page.goto("/logout");
  await expect(page).toHaveURL(/\/login$/);
}
