"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UserCircle2,
  Users
} from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
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
  {
    href: "/volunteer/assignments",
    label: "Mis asignaciones",
    icon: CalendarDays
  },
  { href: "/volunteer/open-slots", label: "Vacantes", icon: Sparkles },
  {
    href: "/volunteer/availability",
    label: "Disponibilidad",
    icon: UserCircle2
  },
  { href: "/volunteer/notifications", label: "Notificaciones", icon: Bell },
  { href: "/volunteer/profile", label: "Perfil", icon: Settings }
];

type AppSidebarProps = {
  role: UserRole;
};

type NavigationContentProps = {
  items: NavItem[];
  onNavigate?: () => void;
  pathname: string;
};

function isActiveRoute(pathname: string, href: string) {
  const isSectionRoot = href === "/admin" || href === "/volunteer";

  if (isSectionRoot) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getNavItems(role: UserRole) {
  return role === "ADMIN" ? adminItems : volunteerItems;
}

function getCurrentSectionLabel(pathname: string, items: NavItem[]) {
  const activeItem = items.find((item) => isActiveRoute(pathname, item.href));
  return activeItem?.label ?? "Navegación";
}

function NavigationContent({
  items,
  onNavigate,
  pathname
}: NavigationContentProps) {
  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
  );
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const items = getNavItems(role);
  const currentSectionLabel = getCurrentSectionLabel(pathname, items);
  const notificationsHref =
    role === "ADMIN" ? "/admin/notifications" : "/volunteer/notifications";

  return (
    <>
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <div className="surface-panel flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold">PPAM</p>
            <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {currentSectionLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={notificationsHref}>
                <Bell className="h-4 w-4" />
                <span className="sr-only">Ir a notificaciones</span>
              </Link>
            </Button>
            <DialogTrigger asChild>
              <Button variant="secondary" size="icon">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Abrir navegación</span>
              </Button>
            </DialogTrigger>
          </div>
        </div>

        <DialogContent
          hideCloseButton
          className="left-auto right-3 top-3 h-[calc(100dvh-1.5rem)] max-h-none w-[min(22rem,calc(100vw-1.5rem))] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-[32px] border border-primary/20 bg-[linear-gradient(180deg,rgba(28,40,66,0.98),rgba(19,30,53,0.98))] p-0 shadow-[0_24px_80px_rgba(3,10,26,0.6)] ease-out data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=closed]:slide-out-to-right-full data-[state=open]:animate-in data-[state=open]:duration-300 data-[state=open]:slide-in-from-right-full lg:hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Navegación</DialogTitle>
            <DialogDescription>Selecciona una página.</DialogDescription>
          </DialogHeader>

          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-white/6 bg-gradient-to-b from-primary/10 to-transparent px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 text-primary shadow-[0_10px_24px_rgba(102,145,255,0.18)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading text-xl font-semibold">PPAM</p>
                      <p className="truncate text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        Planificador
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                      Sección actual
                    </p>
                    <p className="font-heading text-lg font-semibold text-foreground">
                      {currentSectionLabel}
                    </p>
                  </div>
                </div>

                <DialogClose asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-full border-white/10 bg-white/[0.04] text-muted-foreground shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:bg-white/[0.08] hover:text-foreground"
                  >
                    <span className="sr-only">Cerrar navegación</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </Button>
                </DialogClose>
              </div>
            </div>

            <div className="flex h-full min-h-0 flex-col justify-between px-5 pb-5 pt-4">
              <div className="space-y-4 overflow-y-auto pr-1">
                <div className="px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Secciones
                  </p>
                </div>
                <NavigationContent
                  items={items}
                  pathname={pathname}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </div>

              <div className="mt-5 space-y-3 border-t border-white/6 pt-5">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <LifeBuoy className="h-4 w-4" />
                  Soporte
                </button>
                <Button
                  variant="ghost"
                  className="w-full justify-start rounded-2xl px-4"
                  onClick={() => {
                    setMobileNavOpen(false);
                    void signOut({ callbackUrl: "/login" });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

          <NavigationContent items={items} pathname={pathname} />
        </div>

        <div className="space-y-3 border-t border-border/60 pt-5">
          <button className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground">
            <LifeBuoy className="h-4 w-4" />
            Soporte
          </button>
          <Button
            variant="ghost"
            className="w-full justify-start px-4"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
    </>
  );
}
