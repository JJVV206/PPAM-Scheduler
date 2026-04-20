"use client";

import { Bell, CalendarRange, PanelLeftClose } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/lib/utils";
import type { UserRole } from "@/types/domain";

type TopNavbarProps = {
  role: UserRole;
  userName: string;
};

export function TopNavbar({ role, userName }: TopNavbarProps) {
  return (
    <header className="surface-panel sticky top-4 z-20 flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
        <div>
          <p className="font-heading text-lg font-semibold">
            {role === "ADMIN" ? "Coordinator Console" : "Volunteer Portal"}
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4" />
            {formatDisplayDate(new Date(), "EEEE, MMMM d")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{userName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="text-sm font-semibold">{userName}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {role}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
