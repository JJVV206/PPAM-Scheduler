import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/auth";
import type { UserRole } from "@/types/domain";

export async function requireSession() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  return { session };
}

export async function requireRole(roles: UserRole[]) {
  const result = await requireSession();

  if ("error" in result) {
    return result;
  }

  if (!roles.includes(result.session.user.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return result;
}
