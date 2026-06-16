import { describe, expect, it } from "vitest";

import { sanitizeNotificationMetadata } from "@/services/notification.service";

describe("sanitizeNotificationMetadata", () => {
  it("removes reset tokens and password-like values before logging", () => {
    expect(
      sanitizeNotificationMetadata({
        token: "secret-token",
        invitationToken: "invitation-secret",
        confirmationToken: "confirmation-secret",
        resetToken: "reset-secret",
        password: "plain-text",
        passwordHash: "hash",
        resetUrl: "https://example.com/reset/reset-secret",
        responseUrl: "https://example.com/confirm/response-secret",
        pointName: "Hospital Dr Jose G. Parres",
        nested: {
          token: "nested-secret",
          confirmationLink: "https://example.com/confirm/response-id"
        }
      })
    ).toEqual({
      pointName: "Hospital Dr Jose G. Parres"
    });
  });
});
