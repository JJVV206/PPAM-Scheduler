import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMissingRequiredAppEnv,
  getMissingRequiredAuthEnv
} from "@/lib/env/config";

const originalEnv = {
  CRON_SECRET: process.env.CRON_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL
};

afterEach(() => {
  vi.unstubAllEnvs();

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("environment configuration", () => {
  it("does not block auth runtime when only CRON_SECRET is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://example");
    vi.stubEnv("NEXTAUTH_SECRET", "strong-secret");
    vi.stubEnv("NEXTAUTH_URL", "https://ppam.services");
    vi.stubEnv("CRON_SECRET", "");

    expect(getMissingRequiredAuthEnv()).toEqual([]);
    expect(getMissingRequiredAppEnv()).toEqual(["CRON_SECRET"]);
  });
});
