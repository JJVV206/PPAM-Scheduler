import fs from "node:fs";

import { test as setup } from "@playwright/test";

import { loginViaUi } from "./support/auth";
import { authDir, e2eUsers, storageStatePaths } from "./support/config";

setup("authenticate admin @smoke @critical", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  await loginViaUi(page, e2eUsers.admin);
  await page.context().storageState({ path: storageStatePaths.admin });
});

setup("authenticate volunteer @smoke @critical", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  await loginViaUi(page, e2eUsers.volunteer);
  await page.context().storageState({ path: storageStatePaths.volunteer });
});
