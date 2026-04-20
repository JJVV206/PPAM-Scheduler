import { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import type { UserRole } from "@/types/domain";

type PageShellProps = {
  role: UserRole;
  userName: string;
  children: ReactNode;
};

export function PageShell({ role, userName, children }: PageShellProps) {
  return (
    <div className="min-h-screen px-4 py-4">
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <AppSidebar role={role} />
        <main className="min-w-0 flex-1 space-y-4">
          <TopNavbar role={role} userName={userName} />
          {children}
        </main>
      </div>
    </div>
  );
}
