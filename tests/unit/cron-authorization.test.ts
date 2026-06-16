import { describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";

describe("isAuthorizedCronRequest", () => {
  it("accepts the expected bearer token", () => {
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: "Bearer cron-secret",
        cronSecret: "cron-secret"
      })
    ).toBe(true);
  });

  it("rejects missing or mismatched bearer tokens", () => {
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: null,
        cronSecret: "cron-secret"
      })
    ).toBe(false);
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: "Bearer wrong-secret",
        cronSecret: "cron-secret"
      })
    ).toBe(false);
  });

  it("rejects every request when the cron secret is not configured", () => {
    expect(
      isAuthorizedCronRequest({
        authorizationHeader: "Bearer cron-secret"
      })
    ).toBe(false);
  });
});
