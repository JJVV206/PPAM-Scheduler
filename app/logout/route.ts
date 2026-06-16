import { NextResponse, type NextRequest } from "next/server";

import { clearAuthCookies } from "@/lib/auth/cookies";

function getSafeRedirectPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "/login";

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/login";
  }

  return next;
}

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(getSafeRedirectPath(request), request.url)
  );

  clearAuthCookies(response, request);

  return response;
}
