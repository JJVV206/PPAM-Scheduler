import { describe, expect, it } from "vitest";

import { sanitizeNotificationMetadata } from "@/services/notification.service";

describe("sanitizeNotificationMetadata", () => {
  it("removes reset tokens and password-like values before logging", () => {
    expect(
      sanitizeNotificationMetadata({
        token: "secret-token",
        resetToken: "reset-secret",
        password: "plain-text",
        passwordHash: "hash",
        pointName: "Hospital Dr Jose G. Parres",
        nested: {
          token: "nested-secret",
          confirmationLink: "https://example.com/confirm/response-id"
        }
      })
    ).toEqual({
      pointName: "Hospital Dr Jose G. Parres",
      nested: {
        confirmationLink: "https://example.com/confirm/response-id"
      }
    });
  });
});
