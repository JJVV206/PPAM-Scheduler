"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Home,
  LifeBuoy,
  LogOut,
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
  { href: "/admin", label: "Inicio", icon: Home },
  { href: "/admin/schedule", label: "Horario semanal", icon: CalendarDays },
  { href: "/admin/assignments", label: "Asignaciones", icon: ClipboardList },
  { href: "/admin/volunteers", label: "Voluntarios", icon: Users },
  { href: "/admin/open-slots", label: "Vacantes", icon: Sparkles },
  { href: "/admin/notifications", label: "Notificaciones", icon: Bell },
  { href: "/admin/settings", label: "Configuración", icon: Settings }
];

const volunteerItems: NavItem[] = [
  { href: "/volunteer", label: "Inicio", icon: Home },
  { href: "/volunteer/assignments", label: "Mis asignaciones", icon: CalendarDays },
  { href: "/volunteer/open-slots", label: "Vacantes", icon: Sparkles },
  { href: "/volunteer/availability", label: "Disponibilidad", icon: UserCircle2 },
  { href: "/volunteer/notifications", label: "Notificaciones", icon: Bell },
  { href: "/volunteer/profile", label: "Perfil", icon: Settings }
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
    <aside className="surface-panel hidden h-full min-w-72 shrink-0 flex-col justify-between p-5 lg:flex">
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="font-heading text-xl font-semibold">PPAM</p>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Planificador
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
          Soporte
        </button>
        <Button
          variant="ghost"
          className="w-full justify-start px-4"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
