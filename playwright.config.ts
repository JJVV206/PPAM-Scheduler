import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const defaultBaseUrl = `http://localhost:${port}`;
const baseURL = process.env.E2E_BASE_URL ?? defaultBaseUrl;
const useManagedWebServer = !process.env.E2E_BASE_URL;
const authDir = "tests/e2e/.auth";
const workers = Number(process.env.E2E_WORKERS ?? (process.env.CI ? 2 : 1));

function compactEnv(env: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] =>
      Boolean(entry[1])
    )
  );
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: useManagedWebServer
    ? {
        command:
          process.env.E2E_WEB_SERVER_COMMAND ??
          `npm run dev -- --hostname localhost --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: compactEnv({
          ...process.env,
          NEXTAUTH_URL: baseURL,
          NEXTAUTH_SECRET:
            process.env.NEXTAUTH_SECRET ??
            "ppam-e2e-local-secret-change-outside-tests",
          CRON_SECRET:
            process.env.CRON_SECRET ??
            "ppam-e2e-local-cron-secret-change-outside-tests",
          SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
          SMTP_PORT: process.env.SMTP_PORT ?? "1025",
          SMTP_SECURE: process.env.SMTP_SECURE ?? "false",
          SMTP_FROM:
            process.env.SMTP_FROM ??
            "PPAM Scheduler <no-reply@ppam.local>"
        })
      }
    : undefined,
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/
    },
    {
      name: "public-chromium",
      testMatch: /.*public\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"]
      }
    },
    {
      name: "admin-chromium",
      dependencies: ["setup"],
      testMatch: /.*admin\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: `${authDir}/admin.json`
      }
    },
    {
      name: "volunteer-chromium",
      dependencies: ["setup"],
      testMatch: /.*volunteer\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: `${authDir}/volunteer.json`
      }
    },
    {
      name: "admin-mobile",
      dependencies: ["setup"],
      testMatch: /.*responsive\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        storageState: `${authDir}/admin.json`
      }
    }
  ]
});
