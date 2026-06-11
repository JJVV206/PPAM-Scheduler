import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getSessionSecret } from "@/lib/env/config";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: getSessionSecret()
  });

  const isProtectedRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/volunteer");

  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!token) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/volunteer", request.url));
  }

  if (pathname.startsWith("/volunteer") && token.role !== "VOLUNTEER") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname === "/login") {
    return NextResponse.redirect(
      new URL(token.role === "ADMIN" ? "/admin" : "/volunteer", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/volunteer/:path*", "/login"]
};
