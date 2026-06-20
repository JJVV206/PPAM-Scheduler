import { DefaultSession } from "next-auth";

import type { UserAccessStatus, UserRole } from "@/types/domain";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      accessStatus: UserAccessStatus;
      volunteerProfileId?: string | null;
    };
  }

  interface User {
    role: UserRole;
    accessStatus: UserAccessStatus;
    volunteerProfileId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    accessStatus?: UserAccessStatus;
    volunteerProfileId?: string | null;
  }
}
