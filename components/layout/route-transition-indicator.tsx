"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function isPlainLeftClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function shouldTrackNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const nextUrl = new URL(anchor.href, window.location.href);
  if (nextUrl.origin !== window.location.origin) return false;

  const currentRoute = `${window.location.pathname}${window.location.search}`;
  const nextRoute = `${nextUrl.pathname}${nextUrl.search}`;

  return currentRoute !== nextRoute;
}

export function RouteTransitionIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(
    () => `${pathname}?${searchParams.toString()}`,
    [pathname, searchParams]
  );
  const [isNavigating, setIsNavigating] = useState(false);
  const [showSlowNavigationMessage, setShowSlowNavigationMessage] =
    useState(false);
  const timeoutRef = useRef<number | null>(null);
  const slowMessageTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setIsNavigating(false);
    setShowSlowNavigationMessage(false);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (slowMessageTimeoutRef.current) {
      window.clearTimeout(slowMessageTimeoutRef.current);
      slowMessageTimeoutRef.current = null;
    }
  }, [routeKey]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!shouldTrackNavigation(anchor)) return;

      setIsNavigating(true);
      setShowSlowNavigationMessage(false);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (slowMessageTimeoutRef.current) {
        window.clearTimeout(slowMessageTimeoutRef.current);
      }

      slowMessageTimeoutRef.current = window.setTimeout(() => {
        setShowSlowNavigationMessage(true);
        slowMessageTimeoutRef.current = null;
      }, 450);

      timeoutRef.current = window.setTimeout(() => {
        setIsNavigating(false);
        setShowSlowNavigationMessage(false);
        timeoutRef.current = null;
      }, 10000);
    }

    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (slowMessageTimeoutRef.current) {
        window.clearTimeout(slowMessageTimeoutRef.current);
      }
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
      role="status"
    >
      <div className="h-1 w-full overflow-hidden bg-primary/10">
        <div className="h-full w-1/2 animate-[navigation-progress_1.1s_ease-in-out_infinite] rounded-r-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)]" />
      </div>
      {showSlowNavigationMessage ? (
        <div className="fixed right-4 top-4 rounded-full border border-border/70 bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-soft">
          Cargando...
        </div>
      ) : null}
      <span className="sr-only">Cargando página</span>
    </div>
  );
}
