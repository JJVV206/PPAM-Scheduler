import { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { RouteTransitionIndicator } from "@/components/layout/route-transition-indicator";
import type { UserRole } from "@/types/domain";

type PageShellProps = {
  role: UserRole;
  children: ReactNode;
  unreadNotificationCount?: number;
};

export function PageShell({
  role,
  children,
  unreadNotificationCount = 0
}: PageShellProps) {
  return (
    <div className="h-dvh overflow-hidden px-2.5 py-2.5 sm:px-3 sm:py-3">
      <RouteTransitionIndicator />
      <div className="mx-auto flex h-full max-w-[1840px] flex-col gap-3 lg:flex-row lg:gap-3">
        <AppSidebar
          role={role}
          unreadNotificationCount={unreadNotificationCount}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
