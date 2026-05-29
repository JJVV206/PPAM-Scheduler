"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Home,
  LifeBuoy,
  LogOut,
  MapPin,
  Settings,
  UserCircle2,
  Users,
  ClipboardList,
  Sparkles
} from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/domain";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

const adminItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/schedule", label: "Weekly Schedule", icon: CalendarDays },
  { href: "/admin/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/admin/volunteers", label: "Volunteers", icon: Users },
  { href: "/admin/points", label: "Preaching Points", icon: MapPin },
  { href: "/admin/open-slots", label: "Open Slots", icon: Sparkles },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

const volunteerItems: NavItem[] = [
  { href: "/volunteer", label: "Dashboard", icon: Home },
  { href: "/volunteer/assignments", label: "My Assignments", icon: CalendarDays },
  { href: "/volunteer/open-slots", label: "Open Slots", icon: Sparkles },
  { href: "/volunteer/availability", label: "Availability", icon: UserCircle2 },
  { href: "/volunteer/notifications", label: "Notifications", icon: Bell },
  { href: "/volunteer/profile", label: "Profile", icon: Settings }
];

type AppSidebarProps = {
  role: UserRole;
};

function isActiveRoute(pathname: string, href: string) {
  const isSectionRoot = href === "/admin" || href === "/volunteer";

  if (isSectionRoot) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const items = role === "ADMIN" ? adminItems : volunteerItems;

  return (
    <aside className="surface-panel hidden h-[calc(100vh-2rem)] min-w-72 flex-col justify-between p-5 lg:flex">
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="font-heading text-xl font-semibold">PPAM</p>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Scheduler
            </p>
          </div>
        </div>

        <nav className="space-y-2">
          {items.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-white/5 hover:text-foreground",
                  active &&
                    "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(133,168,255,0.2)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-5">
        <button className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground">
          <LifeBuoy className="h-4 w-4" />
          Support
        </button>
        <Button
          variant="ghost"
          className="w-full justify-start px-4"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
