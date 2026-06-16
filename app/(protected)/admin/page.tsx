import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  MailWarning,
  TimerOff,
  UserSearch
} from "lucide-react";
import Link from "next/link";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { EmptyState } from "@/components/forms/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VOLUNTEER_POSITION_LABELS } from "@/lib/constants/domain";
import { getServerAuthSession } from "@/lib/auth/auth";
import {
  getUnreadCriticalAppNotificationsForUser,
  type AppNotificationListItem
} from "@/services/app-notification.service";
import { getAdminDashboardStats } from "@/services/dashboard.service";
import { formatDisplayDate } from "@/lib/utils";

function getAttentionNotificationHref(notification: AppNotificationListItem) {
  if (notification.assignmentId) {
    return `/admin/assignments/${notification.assignmentId}`;
  }

  if (notification.censusId) {
    return "/admin/replacements";
  }

  return "/admin/attention";
}

function AlertMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/25 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warning/12 text-warning">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-heading text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await getServerAuthSession();
  const [dashboard, attentionNotifications] = await Promise.all([
    getAdminDashboardStats(),
    session?.user.id
      ? getUnreadCriticalAppNotificationsForUser({
          userId: session.user.id
        })
      : []
  ]);
  const attentionCount =
    dashboard.stats.requiresAttention + attentionNotifications.length;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Panel administrativo</h1>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Turnos cubiertos"
          value={dashboard.stats.confirmedAssignments}
          icon={CheckCircle2}
        />
        <DashboardStatCard
          label="Pendientes"
          value={dashboard.stats.pendingConfirmations}
          icon={ClipboardCheck}
        />
        <DashboardStatCard
          label="Buscando suplente"
          value={dashboard.stats.needsReplacement}
          icon={UserSearch}
        />
        <DashboardStatCard
          label="Requieren atención"
          value={attentionCount}
          icon={AlertTriangle}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="surface-panel space-y-5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-semibold">
                Cobertura semanal
              </h2>
              <p className="text-sm text-muted-foreground">
                {dashboard.weekLabel}
              </p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/schedule">
                Horario semanal
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-success/20 bg-success/10 p-4">
              <p className="text-sm text-muted-foreground">Confirmadas</p>
              <p className="font-heading text-3xl font-semibold">
                {dashboard.stats.confirmedAssignments}
              </p>
            </div>
            <div className="rounded-2xl border border-warning/20 bg-warning/10 p-4">
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="font-heading text-3xl font-semibold">
                {dashboard.stats.pendingConfirmations}
              </p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-sm text-muted-foreground">Buscando suplente</p>
              <p className="font-heading text-3xl font-semibold">
                {dashboard.stats.needsReplacement}
              </p>
            </div>
            <div className="rounded-2xl border border-danger/20 bg-danger/10 p-4">
              <p className="text-sm text-muted-foreground">Atención manual</p>
              <p className="font-heading text-3xl font-semibold">
                {attentionCount}
              </p>
            </div>
          </div>
        </div>

        <div className="surface-panel space-y-5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-semibold">
                Censo de suplentes
              </h2>
              <p className="text-sm text-muted-foreground">
                {dashboard.census.closesAt
                  ? `Cierra ${formatDisplayDate(
                      dashboard.census.closesAt,
                      "d 'de' MMMM, HH:mm"
                    )}`
                  : "Sin censo activo para esta semana"}
              </p>
            </div>
            <Badge variant={dashboard.census.totalResponses ? "default" : "outline"}>
              {dashboard.census.status}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/25 p-4">
              <p className="text-sm text-muted-foreground">Invitados</p>
              <p className="font-heading text-2xl font-semibold">
                {dashboard.census.totalResponses}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/25 p-4">
              <p className="text-sm text-muted-foreground">Respondieron</p>
              <p className="font-heading text-2xl font-semibold">
                {dashboard.census.submittedResponses}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/25 p-4">
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="font-heading text-2xl font-semibold">
                {dashboard.census.pendingResponses}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/25 px-4 py-3">
            <span className="text-sm text-muted-foreground">Respuesta</span>
            <span className="font-semibold">{dashboard.census.responseRate}%</span>
          </div>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/admin/replacements">Abrir censo de suplentes</Link>
          </Button>
        </div>
      </section>

      <section className="surface-panel space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-semibold">
              Requiere atención
            </h2>
            <p className="text-sm text-muted-foreground">
              Casos donde la automatización ya no debe resolver sola.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/attention">
              Ver casos
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {attentionNotifications.slice(0, 3).map((notification) => (
            <Link
              key={notification.id}
              href={getAttentionNotificationHref(notification)}
              className="group rounded-2xl border border-danger/20 bg-danger/[0.04] p-4 transition hover:border-danger/35 hover:bg-danger/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="space-y-3">
                <Badge variant="danger">Crítica</Badge>
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-semibold">
                    {notification.title}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {notification.body}
                  </p>
                </div>
                <p className="flex items-center justify-between text-sm font-medium text-danger">
                  <span>{formatDisplayDate(notification.createdAt, "d MMM, h:mm a")}</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
          ))}

          {dashboard.requiresAttention
            .slice(0, Math.max(0, 3 - attentionNotifications.length))
            .map((assignment) => (
              <Link
                key={assignment.id}
                href={`/admin/assignments/${assignment.id}`}
                className="group rounded-2xl border border-warning/20 bg-warning/[0.04] p-4 transition hover:border-warning/35 hover:bg-warning/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="space-y-3">
                  <Badge variant="warning">Alta</Badge>
                  <div>
                    <h3 className="font-heading text-lg font-semibold">
                      {assignment.preachingPoint.name}
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {assignment.warnings.length
                        ? assignment.warnings.join(" · ")
                        : assignment.automationState.description}
                    </p>
                  </div>
                  <p className="flex items-center justify-between text-sm font-medium text-warning">
                    <span>{formatDisplayDate(assignment.date, "d MMM")}</span>
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </p>
                </div>
              </Link>
            ))}

          {!attentionNotifications.length && !dashboard.requiresAttention.length ? (
            <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              El flujo automático no requiere acciones manuales ahora.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="surface-panel space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-semibold">
                Próximos turnos
              </h2>
              <p className="text-sm text-muted-foreground">
                Hoy y los próximos 3 días.
              </p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/schedule">Ver horario</Link>
            </Button>
          </div>

          {dashboard.upcomingAssignments.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {dashboard.upcomingAssignments.slice(0, 6).map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/admin/assignments/${assignment.id}`}
                  className="group block h-full rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <AssignmentCard
                    assignment={assignment}
                    className="transition-all duration-200 group-hover:border-primary/35 group-hover:bg-primary/[0.05]"
                    action={
                      <div className="flex items-center justify-between border-t border-white/5 pt-3 text-sm font-medium text-primary">
                        <span>Ver detalle</span>
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                    }
                  />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sin turnos próximos"
              description="No hay turnos programados para hoy ni los siguientes días."
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="surface-panel space-y-4 p-5">
            <h2 className="font-heading text-2xl font-semibold">Alertas</h2>
            <div className="grid gap-3">
              <AlertMetric
                icon={MailWarning}
                label="Emails fallidos"
                value={dashboard.alerts.failedEmails}
              />
              <AlertMetric
                icon={TimerOff}
                label="Titulares vencidos"
                value={dashboard.alerts.expiredPrimaryInvitations}
              />
              <AlertMetric
                icon={UserSearch}
                label="Suplentes vencidos"
                value={dashboard.alerts.expiredReplacementInvitations}
              />
              <AlertMetric
                icon={AlertTriangle}
                label="Turnos sin cobertura"
                value={dashboard.alerts.uncoveredAssignments}
              />
            </div>
          </div>

          <div className="surface-panel space-y-4 p-5">
            <h2 className="font-heading text-2xl font-semibold">
              Acciones rápidas
            </h2>
            <div className="grid gap-2">
              <Button asChild variant="secondary" className="justify-start">
                <Link href="/admin/attention">Ver caso urgente</Link>
              </Button>
              <Button asChild variant="secondary" className="justify-start">
                <Link href="/admin/schedule">Ir al horario semanal</Link>
              </Button>
              <Button asChild variant="secondary" className="justify-start">
                <Link href="/admin/assignments">Revisar invitaciones pendientes</Link>
              </Button>
              <Button asChild variant="secondary" className="justify-start">
                <Link href="/admin/replacements">Abrir censo de suplentes</Link>
              </Button>
            </div>
          </div>

          {dashboard.urgentReplacements.length ? (
            <div className="surface-panel space-y-4 p-5">
              <h2 className="font-heading text-2xl font-semibold">
                Reemplazos urgentes
              </h2>
              <div className="grid gap-3">
                {dashboard.urgentReplacements.slice(0, 3).map((openSlot) => (
                  <Link
                    key={openSlot.assignmentId}
                    href={`/admin/assignments/${openSlot.assignmentId}`}
                    className="rounded-2xl border border-danger/20 bg-danger/[0.04] p-4 transition hover:border-danger/35"
                  >
                    <p className="font-medium">{openSlot.preachingPointName}</p>
                    <p className="text-sm text-muted-foreground">
                      {openSlot.urgencyLabel} ·{" "}
                      {openSlot.missingPositions
                        .map((position) => VOLUNTEER_POSITION_LABELS[position])
                        .join(" y ")}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
