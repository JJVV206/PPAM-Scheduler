import { DefaultSession } from "next-auth";

import type { UserRole } from "@/types/domain";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      volunteerProfileId?: string | null;
    };
  }

  interface User {
    role: UserRole;
    volunteerProfileId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    volunteerProfileId?: string | null;
  }
}
