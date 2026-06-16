import { describe, expect, it } from "vitest";

import { getAuthCookieNamesToClear } from "@/middleware";

describe("middleware auth cookies", () => {
  it("includes fixed and chunked NextAuth cookies for stale-session cleanup", () => {
    const request = {
      cookies: {
        getAll: () => [
          { name: "__Secure-next-auth.session-token.0", value: "a" },
          { name: "__Secure-next-auth.session-token.1", value: "b" },
          { name: "next-auth.session-token.0", value: "c" },
          { name: "unrelated", value: "d" }
        ]
      }
    };

    expect(getAuthCookieNamesToClear(request)).toEqual(
      expect.arrayContaining([
        "__Host-next-auth.csrf-token",
        "__Secure-next-auth.callback-url",
        "__Secure-next-auth.session-token",
        "__Secure-next-auth.session-token.0",
        "__Secure-next-auth.session-token.1",
        "next-auth.callback-url",
        "next-auth.csrf-token",
        "next-auth.session-token",
        "next-auth.session-token.0"
      ])
    );
    expect(getAuthCookieNamesToClear(request)).not.toContain("unrelated");
  });
});
