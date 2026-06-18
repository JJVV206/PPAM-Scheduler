"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BellRing,
  Check,
  CheckCheck,
  ExternalLink,
  Loader2
} from "lucide-react";

import { EmptyState } from "@/components/forms/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import type { AppNotificationListItem } from "@/services/app-notification.service";
import { cn, formatDisplayDate } from "@/lib/utils";
import type { UserRole } from "@/types/domain";

type AppNotificationListProps = {
  notifications: AppNotificationListItem[];
  role: UserRole;
};

const typeLabels: Record<string, string> = {
  CENSUS_PENDING: "Censo pendiente",
  ASSIGNMENT_PENDING: "Asignación pendiente",
  ASSIGNMENT_CONFIRMED: "Asignación confirmada",
  REPLACEMENT_NEEDED: "Suplente requerido",
  ADMIN_ATTENTION_REQUIRED: "Atención requerida",
  EMAIL_FAILED: "Email fallido"
};

const priorityLabels: Record<string, string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente"
};

function getPriorityVariant(priority: string) {
  if (priority === "URGENT") return "danger" as const;
  if (priority === "HIGH") return "warning" as const;
  if (priority === "LOW") return "outline" as const;
  return "secondary" as const;
}

function getNotificationHref(
  notification: AppNotificationListItem,
  role: UserRole
) {
  if (notification.assignmentId) {
    return role === "ADMIN"
      ? `/admin/assignments/${notification.assignmentId}`
      : `/volunteer/assignments/${notification.assignmentId}`;
  }

  if (notification.censusId) {
    return role === "ADMIN" ? "/admin/replacements" : "/volunteer/availability";
  }

  return role === "ADMIN" ? "/admin" : "/volunteer";
}

export function AppNotificationList({
  notifications,
  role
}: AppNotificationListProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | "all" | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  async function markRead(notificationId: string) {
    setLoading(notificationId);
    setFeedback(null);

    const response = await fetch(
      `/api/app-notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: "POST"
      }
    );
    const result = await response.json();

    setLoading(null);
    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? "Notificación marcada como leída."
        : (result.error ?? "No fue posible actualizar la notificación.")
    });

    if (response.ok) {
      router.refresh();
    }
  }

  async function markAllRead() {
    setLoading("all");
    setFeedback(null);

    const response = await fetch("/api/app-notifications/read-all", {
      method: "POST"
    });
    const result = await response.json();

    setLoading(null);
    setFeedback({
      tone: response.ok ? "success" : "error",
      text: response.ok
        ? "Notificaciones marcadas como leídas."
        : (result.error ?? "No fue posible actualizar las notificaciones.")
    });

    if (response.ok) {
      router.refresh();
    }
  }

  if (!notifications.length) {
    return (
      <EmptyState
        title="Sin notificaciones internas"
        description="Cuando haya pendientes o alertas operativas aparecerán aquí."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BellRing className="h-4 w-4" />
          <span>
            {unreadCount
              ? `${unreadCount} sin leer`
              : "Todas las notificaciones están leídas"}
          </span>
        </div>
        {unreadCount ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={markAllRead}
            disabled={loading !== null}
          >
            {loading === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Marcar todas leídas
          </Button>
        ) : null}
      </div>

      <FeedbackMessage tone={feedback?.tone} message={feedback?.text} />

      <div className="grid gap-3">
        {notifications.map((notification) => {
          const unread = !notification.readAt;
          const href = getNotificationHref(notification, role);

          return (
            <article
              key={notification.id}
              className={cn(
                "rounded-2xl border p-4 transition",
                unread
                  ? "border-primary/30 bg-primary/[0.06]"
                  : "border-border/70 bg-background/35"
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={unread ? "default" : "outline"}>
                      {unread ? "Sin leer" : "Leída"}
                    </Badge>
                    <Badge variant={getPriorityVariant(notification.priority)}>
                      {priorityLabels[notification.priority] ??
                        notification.priority}
                    </Badge>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {typeLabels[notification.type] ?? notification.type}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-heading text-lg font-semibold">
                      {notification.title}
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {notification.body}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayDate(
                      notification.createdAt,
                      "d 'de' MMMM, h:mm a"
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={href}>
                      <ExternalLink className="h-4 w-4" />
                      Ver detalles
                    </Link>
                  </Button>
                  {unread ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead(notification.id)}
                      disabled={loading !== null}
                    >
                      {loading === notification.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Marcar leída
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
