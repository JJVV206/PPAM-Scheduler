import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getSessionSecret } from "@/lib/env/config";

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

export function getAuthCookieNamesToClear(
  request: {
    cookies: {
      getAll(): Array<{ name: string }>;
    };
  }
) {
  const names = new Set<string>(AUTH_COOKIE_NAMES);

  for (const cookie of request.cookies.getAll()) {
    if (AUTH_COOKIE_PREFIXES.some((prefix) => cookie.name.startsWith(prefix))) {
      names.add(cookie.name);
    }
  }

  return [...names];
}

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  for (const name of getAuthCookieNamesToClear(request)) {
    response.cookies.delete(name);
  }
}

async function readToken(request: NextRequest) {
  try {
    return await getToken({
      req: request,
      secret: getSessionSecret()
    });
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = await readToken(request);

  const isHomeRoute = pathname === "/";
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isProtectedRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/volunteer");

  if (!token && isHomeRoute) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearAuthCookies(response, request);
    return response;
  }

  if (!token && isAuthRoute) {
    const response = NextResponse.next();
    clearAuthCookies(response, request);
    return response;
  }

  if (!token && isProtectedRoute) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearAuthCookies(response, request);
    return response;
  }

  if (!token) {
    return NextResponse.next();
  }

  if (isHomeRoute || isAuthRoute) {
    return NextResponse.redirect(
      new URL(token.role === "ADMIN" ? "/admin" : "/volunteer", request.url)
    );
  }

  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/volunteer", request.url));
  }

  if (pathname.startsWith("/volunteer") && token.role !== "VOLUNTEER") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/admin/:path*", "/volunteer/:path*"]
};
