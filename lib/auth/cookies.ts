import type { NextResponse } from "next/server";

const AUTH_COOKIE_NAMES = [
  "__Host-next-auth.csrf-token",
  "__Secure-next-auth.callback-url",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "next-auth.csrf-token",
  "next-auth.session-token"
] as const;

const AUTH_COOKIE_PREFIXES = [
  "__Secure-next-auth.session-token.",
  "next-auth.session-token."
] as const;

type CookieRequest = {
  cookies: {
    getAll(): Array<{ name: string }>;
  };
};

export function getAuthCookieNamesToClear(request: CookieRequest) {
  const names = new Set<string>(AUTH_COOKIE_NAMES);

  for (const cookie of request.cookies.getAll()) {
    if (AUTH_COOKIE_PREFIXES.some((prefix) => cookie.name.startsWith(prefix))) {
      names.add(cookie.name);
    }
  }

  return [...names];
}

export function clearAuthCookies(
  response: NextResponse,
  request: CookieRequest
) {
  for (const name of getAuthCookieNamesToClear(request)) {
    response.cookies.delete(name);
  }
}
