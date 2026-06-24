import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  MailWarning,
  TimerOff,
  UserSearch
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { getAdminDashboardStats } from "@/services/dashboard.service";
import { formatDisplayDate } from "@/lib/utils";

type MetricTone = "success" | "warning" | "primary" | "danger";

const toneClasses: Record<
  MetricTone,
  {
    card: string;
    icon: string;
  }
> = {
  success: {
    card: "border-success/20 bg-success/10",
    icon: "bg-success/15 text-success"
  },
  warning: {
    card: "border-warning/20 bg-warning/10",
    icon: "bg-warning/15 text-warning"
  },
  primary: {
    card: "border-primary/20 bg-primary/10",
    icon: "bg-primary/15 text-primary"
  },
  danger: {
    card: "border-danger/20 bg-danger/10",
    icon: "bg-danger/15 text-danger"
  }
};

function CoverageMetric({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: MetricTone;
}) {
  return (
    <div
      className={`${toneClasses[tone].card} flex min-h-[5.75rem] flex-col justify-between rounded-lg border p-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-5 text-muted-foreground">{label}</p>
        <div
          className={`${toneClasses[tone].icon} flex h-7 w-7 shrink-0 items-center justify-center rounded-lg`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="font-heading text-2xl font-semibold leading-none sm:text-3xl">
        {value}
      </p>
    </div>
  );
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
    <div className="grid min-h-[5.75rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
      <span className="bg-warning/12 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-warning">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-2xl font-semibold leading-none">
          {value}
        </p>
        <p className="mt-1 min-w-0 text-sm leading-5 text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

function CensusMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-[4.75rem] flex-col justify-between rounded-lg border border-border/70 bg-background/35 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold leading-none">
        {value}
      </p>
    </div>
  );
}

function DashboardPanelHeader({
  title,
  description,
  badge
}: {
  title: string;
  description: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-heading text-xl font-semibold leading-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {badge ? (
        <div className="flex shrink-0 items-center gap-2">{badge}</div>
      ) : null}
    </div>
  );
}

function CoveragePanel({
  dashboard
}: {
  dashboard: Awaited<ReturnType<typeof getAdminDashboardStats>>;
}) {
  return (
    <Link
      href="/admin/schedule"
      className="surface-panel group flex flex-col gap-3 p-3 transition hover:border-primary/35 hover:bg-surface-elevated/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:p-4"
      aria-label="Ir a horario semanal"
    >
      <DashboardPanelHeader
        title="Cobertura semanal"
        description={dashboard.weekLabel}
      />

      <div className="grid flex-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-4">
        <CoverageMetric
          icon={CheckCircle2}
          label="Confirmadas"
          value={dashboard.stats.confirmedAssignments}
          tone="success"
        />
        <CoverageMetric
          icon={ClipboardCheck}
          label="Pendientes"
          value={dashboard.stats.pendingConfirmations}
          tone="warning"
        />
        <CoverageMetric
          icon={UserSearch}
          label="Buscando suplente"
          value={dashboard.stats.needsReplacement}
          tone="primary"
        />
        <CoverageMetric
          icon={AlertTriangle}
          label="Atención manual"
          value={dashboard.stats.requiresAttention}
          tone="danger"
        />
      </div>
    </Link>
  );
}

function AlertsPanel({
  dashboard
}: {
  dashboard: Awaited<ReturnType<typeof getAdminDashboardStats>>;
}) {
  return (
    <Link
      href="/admin/attention"
      className="surface-panel group flex flex-col gap-3 p-3 transition hover:border-primary/35 hover:bg-surface-elevated/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:p-4"
      aria-label="Ir a atención requerida"
    >
      <DashboardPanelHeader
        title="Alertas"
        description="Incidencias que requieren revisión operativa."
      />
      <div className="grid flex-1 gap-2.5 sm:grid-cols-2">
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
    </Link>
  );
}

function ReplacementCensusPanel({
  dashboard
}: {
  dashboard: Awaited<ReturnType<typeof getAdminDashboardStats>>;
}) {
  return (
    <Link
      href="/admin/replacements"
      className="surface-panel group flex flex-col gap-3 p-3 transition hover:border-primary/35 hover:bg-surface-elevated/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:p-4 xl:row-span-2"
      aria-label="Ir a suplentes"
    >
      <DashboardPanelHeader
        title="Censo de suplentes"
        description={
          dashboard.census.closesAt
            ? `Cierra ${formatDisplayDate(
                dashboard.census.closesAt,
                "d 'de' MMMM, HH:mm"
              )}`
            : "Sin censo activo para esta semana"
        }
        badge={
          <Badge
            variant={dashboard.census.totalResponses ? "default" : "outline"}
          >
            {dashboard.census.status}
          </Badge>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-3">
        <CensusMetric
          label="Invitados"
          value={dashboard.census.totalResponses}
        />
        <CensusMetric
          label="Respondieron"
          value={dashboard.census.submittedResponses}
        />
        <CensusMetric
          label="Pendientes"
          value={dashboard.census.pendingResponses}
        />
      </div>

      <div className="flex flex-1 flex-col justify-center rounded-lg border border-border/70 bg-background/35 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Respuesta del censo</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {dashboard.census.submittedResponses} de{" "}
              {dashboard.census.totalResponses} respondieron
            </p>
          </div>
          <p className="font-heading text-4xl font-semibold leading-none">
            {dashboard.census.responseRate}%
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${dashboard.census.responseRate}%` }}
          />
        </div>
        <Badge
          variant={dashboard.census.pendingResponses ? "warning" : "success"}
          className="mt-3 w-fit"
        >
          {dashboard.census.pendingResponses
            ? "Seguimiento pendiente"
            : "Censo al día"}
        </Badge>
      </div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboardStats();

  return (
    <div className="grid min-h-full gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)] xl:grid-rows-[auto_minmax(0,1fr)]">
      <h1 className="sr-only">Panel administrativo</h1>
      <CoveragePanel dashboard={dashboard} />
      <ReplacementCensusPanel dashboard={dashboard} />
      <AlertsPanel dashboard={dashboard} />
    </div>
  );
}
