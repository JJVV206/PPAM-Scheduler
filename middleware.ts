import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { clearAuthCookies } from "@/lib/auth/cookies";
import { getSessionSecret } from "@/lib/env/config";

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
    return NextResponse.next();
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
