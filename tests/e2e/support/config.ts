import path from "node:path";

export const authDir = path.resolve(__dirname, "..", ".auth");

export const e2eUsers = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "e2e+ppam-admin@example.invalid",
    password: process.env.E2E_ADMIN_PASSWORD ?? "E2EAdmin123!",
    homePath: "/admin"
  },
  volunteer: {
    email:
      process.env.E2E_VOLUNTEER_EMAIL ??
      "e2e+ppam-volunteer@example.invalid",
    password: process.env.E2E_VOLUNTEER_PASSWORD ?? "E2EVolunteer123!",
    homePath: "/volunteer"
  },
  replacement: {
    email:
      process.env.E2E_REPLACEMENT_EMAIL ??
      "e2e+ppam-replacement@example.invalid",
    password: process.env.E2E_REPLACEMENT_PASSWORD ?? "E2EReplacement123!",
    homePath: "/volunteer"
  }
} as const;

export const storageStatePaths = {
  admin: path.join(authDir, "admin.json"),
  volunteer: path.join(authDir, "volunteer.json")
} as const;
