import { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import type { UserRole } from "@/types/domain";

type PageShellProps = {
  role: UserRole;
  children: ReactNode;
};

export function PageShell({ role, children }: PageShellProps) {
  return (
    <div className="h-dvh overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto flex h-full max-w-[1760px] flex-col gap-3 lg:flex-row lg:gap-4">
        <AppSidebar role={role} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
