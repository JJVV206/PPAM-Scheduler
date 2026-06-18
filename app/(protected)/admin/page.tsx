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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      className={`${toneClasses[tone].card} flex min-h-[6.75rem] flex-col justify-between rounded-lg border p-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-5 text-muted-foreground">{label}</p>
        <div
          className={`${toneClasses[tone].icon} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="font-heading text-3xl font-semibold leading-none sm:text-4xl">
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
    <div className="flex min-h-[4.75rem] items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-warning/12 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-warning">
          <Icon className="h-4 w-4" />
        </span>
        <p className="min-w-0 text-sm leading-5 text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="font-heading text-2xl font-semibold leading-none">
        {value}
      </p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboardStats();
  const totalAlerts =
    dashboard.alerts.failedEmails +
    dashboard.alerts.expiredPrimaryInvitations +
    dashboard.alerts.expiredReplacementInvitations +
    dashboard.alerts.uncoveredAssignments;

  return (
    <div className="flex min-h-full flex-col gap-3">
      <div className="surface-panel flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            Panel administrativo
          </h1>
          <p className="text-sm text-muted-foreground">
            Operación diaria, cobertura y excepciones de la semana.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/attention">Atención requerida</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/schedule">Horario semanal</Link>
          </Button>
        </div>
      </div>

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
        <div className="space-y-3">
          <div className="surface-panel space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-heading text-xl font-semibold">
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

            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
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
          </div>

          <div className="surface-panel flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-semibold">Alertas</h2>
                <p className="text-sm text-muted-foreground">
                  Incidencias que requieren revisión operativa.
                </p>
              </div>
              <Badge variant={totalAlerts ? "warning" : "outline"}>
                {totalAlerts ? `${totalAlerts} activas` : "Sin alertas"}
              </Badge>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-2">
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
        </div>

        <div className="surface-panel flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold">
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
            <Badge
              variant={dashboard.census.totalResponses ? "default" : "outline"}
            >
              {dashboard.census.status}
            </Badge>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="flex min-h-[5.5rem] flex-col justify-between rounded-lg border border-border/70 bg-background/35 p-3">
              <p className="text-sm text-muted-foreground">Invitados</p>
              <p className="font-heading text-2xl font-semibold leading-none">
                {dashboard.census.totalResponses}
              </p>
            </div>
            <div className="flex min-h-[5.5rem] flex-col justify-between rounded-lg border border-border/70 bg-background/35 p-3">
              <p className="text-sm text-muted-foreground">Respondieron</p>
              <p className="font-heading text-2xl font-semibold leading-none">
                {dashboard.census.submittedResponses}
              </p>
            </div>
            <div className="flex min-h-[5.5rem] flex-col justify-between rounded-lg border border-border/70 bg-background/35 p-3">
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="font-heading text-2xl font-semibold leading-none">
                {dashboard.census.pendingResponses}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/35 p-4">
            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Respuesta</p>
                  <p className="font-heading text-4xl font-semibold leading-none">
                    {dashboard.census.responseRate}%
                  </p>
                </div>
                <Badge
                  variant={
                    dashboard.census.pendingResponses ? "warning" : "success"
                  }
                >
                  {dashboard.census.pendingResponses
                    ? "Seguimiento pendiente"
                    : "Censo al día"}
                </Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${dashboard.census.responseRate}%` }}
                />
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {dashboard.census.submittedResponses} de{" "}
              {dashboard.census.totalResponses} suplentes respondieron.
            </p>
          </div>

          <Button asChild variant="secondary" className="mt-auto w-full">
            <Link href="/admin/replacements">Abrir censo de suplentes</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
