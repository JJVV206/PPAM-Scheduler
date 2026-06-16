"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ClipboardList,
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserCircle2,
  UserCheck,
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

const SIDEBAR_COLLAPSED_STORAGE_KEY = "ppam-sidebar-collapsed";

const adminItems: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: Home },
  { href: "/admin/schedule", label: "Horario semanal", icon: CalendarDays },
  {
    href: "/admin/attention",
    label: "Atención requerida",
    icon: AlertTriangle
  },
  { href: "/admin/replacements", label: "Suplentes", icon: UserCheck },
  { href: "/admin/assignments", label: "Asignaciones", icon: ClipboardList },
  { href: "/admin/volunteers", label: "Voluntarios", icon: Users },
  { href: "/admin/settings", label: "Configuración", icon: Settings }
];

const volunteerItems: NavItem[] = [
  { href: "/volunteer", label: "Inicio", icon: Home },
  {
    href: "/volunteer/assignments",
    label: "Mis asignaciones",
    icon: CalendarDays
  },
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
  unreadNotificationCount?: number;
};

type NavigationContentProps = {
  collapsed?: boolean;
  items: NavItem[];
  onNavigate?: () => void;
  onPreload?: (href: string) => void;
  pathname: string;
  notificationsHref: string;
  unreadNotificationCount: number;
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
  collapsed = false,
  items,
  notificationsHref,
  onNavigate,
  onPreload,
  pathname,
  unreadNotificationCount
}: NavigationContentProps) {
  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        const Icon = item.icon;
        const showNotificationCount =
          item.href === notificationsHref && unreadNotificationCount > 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={onNavigate}
            onFocus={() => onPreload?.(item.href)}
            onPointerEnter={() => onPreload?.(item.href)}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center rounded-2xl text-sm font-medium text-muted-foreground transition hover:bg-white/5 hover:text-foreground",
              collapsed ? "h-11 justify-center px-0" : "gap-3 px-4 py-3",
              active &&
                "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(133,168,255,0.2)]"
            )}
          >
            <span className="relative inline-flex shrink-0">
              <Icon className="h-4 w-4 shrink-0" />
              {collapsed && showNotificationCount ? (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-danger-foreground">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              ) : null}
            </span>
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {showNotificationCount ? (
                  <span className="ml-auto rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold leading-none text-danger">
                    {unreadNotificationCount > 99
                      ? "99+"
                      : unreadNotificationCount}
                  </span>
                ) : null}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar({
  role,
  unreadNotificationCount = 0
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const items = getNavItems(role);
  const currentSectionLabel = getCurrentSectionLabel(pathname, items);
  const notificationsHref =
    role === "ADMIN" ? "/admin/attention" : "/volunteer/notifications";
  const preloadRoute = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );
  const toggleDesktopSidebar = useCallback(() => {
    setDesktopCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_STORAGE_KEY,
          String(next)
        );
      } catch {
        // The sidebar still works if browser storage is unavailable.
      }

      return next;
    });
  }, []);

  useEffect(() => {
    try {
      setDesktopCollapsed(
        window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
      );
    } catch {
      setDesktopCollapsed(false);
    }
  }, []);

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
              <Link
                href={notificationsHref}
                className="relative"
                aria-label={
                  unreadNotificationCount > 0
                    ? `Ir a notificaciones, ${unreadNotificationCount} sin leer`
                    : "Ir a notificaciones"
                }
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-danger-foreground">
                    {unreadNotificationCount > 9
                      ? "9+"
                      : unreadNotificationCount}
                  </span>
                ) : null}
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
          className="left-auto right-3 top-3 h-[calc(100dvh-1.5rem)] max-h-none w-[min(22rem,calc(100vw-1.5rem))] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-[32px] border border-primary/20 bg-[linear-gradient(180deg,rgba(28,40,66,0.98),rgba(19,30,53,0.98))] p-0 shadow-[0_24px_80px_rgba(3,10,26,0.6)] ease-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full lg:hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Navegación</DialogTitle>
            <DialogDescription>Selecciona una página.</DialogDescription>
          </DialogHeader>

          <div className="flex h-full min-h-0 flex-col">
            <div className="border-white/6 border-b bg-gradient-to-b from-primary/10 to-transparent px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-primary/20 shadow-[0_10px_24px_rgba(102,145,255,0.18)]">
                      <Image
                        src="/favicon.png"
                        alt=""
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading text-xl font-semibold">PPAM</p>
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
                  notificationsHref={notificationsHref}
                  pathname={pathname}
                  unreadNotificationCount={unreadNotificationCount}
                  onPreload={preloadRoute}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </div>

              <div className="border-white/6 mt-5 space-y-3 border-t pt-5">
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

      <aside
        className={cn(
          "surface-panel hidden h-full shrink-0 flex-col justify-between transition-[width,min-width,padding] duration-200 ease-out lg:flex",
          desktopCollapsed
            ? "w-[76px] min-w-[76px] p-3"
            : "w-[244px] min-w-[244px] p-4 xl:w-[256px] xl:min-w-[256px] 2xl:w-[280px] 2xl:min-w-[280px] 2xl:p-5"
        )}
      >
        <div className={cn("space-y-7", desktopCollapsed && "space-y-5")}>
          <div
            className={cn(
              "flex gap-3",
              desktopCollapsed
                ? "flex-col items-center"
                : "items-center justify-between"
            )}
          >
            <div
              className={cn(
                "flex min-w-0 items-center gap-3",
                desktopCollapsed && "justify-center"
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-primary/20 shadow-glow",
                  desktopCollapsed && "h-11 w-11"
                )}
              >
                <Image
                  src="/favicon.png"
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </div>
              {!desktopCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate font-heading text-xl font-semibold">
                    PPAM
                  </p>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-expanded={!desktopCollapsed}
              aria-label={
                desktopCollapsed
                  ? "Expandir navegación"
                  : "Minimizar navegación"
              }
              title={
                desktopCollapsed
                  ? "Expandir navegación"
                  : "Minimizar navegación"
              }
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={toggleDesktopSidebar}
            >
              {desktopCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <NavigationContent
            collapsed={desktopCollapsed}
            items={items}
            notificationsHref={notificationsHref}
            pathname={pathname}
            unreadNotificationCount={unreadNotificationCount}
            onPreload={preloadRoute}
          />
        </div>

        <div
          className={cn(
            "space-y-3 border-t border-border/60 pt-5",
            desktopCollapsed && "flex flex-col items-center"
          )}
        >
          <button
            type="button"
            title="Soporte"
            className={cn(
              "flex items-center text-sm text-muted-foreground transition hover:text-foreground",
              desktopCollapsed
                ? "h-10 w-10 justify-center rounded-2xl px-0 py-0 hover:bg-white/5"
                : "gap-3 px-4 py-2"
            )}
          >
            <LifeBuoy className="h-4 w-4 shrink-0" />
            {desktopCollapsed ? (
              <span className="sr-only">Soporte</span>
            ) : (
              "Soporte"
            )}
          </button>
          <Button
            variant="ghost"
            title="Cerrar sesión"
            className={cn(
              desktopCollapsed
                ? "h-10 w-10 justify-center px-0"
                : "w-full justify-start px-4"
            )}
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {desktopCollapsed ? (
              <span className="sr-only">Cerrar sesión</span>
            ) : (
              "Cerrar sesión"
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
