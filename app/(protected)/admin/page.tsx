import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Sparkles
} from "lucide-react";
import Link from "next/link";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { EmptyState } from "@/components/forms/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VOLUNTEER_POSITION_LABELS } from "@/lib/constants/domain";
import { getAdminDashboardStats } from "@/services/dashboard.service";

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboardStats();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <DashboardStatCard
          label="Asignaciones semanales"
          value={dashboard.stats.totalAssignments}
          icon={CalendarCheck2}
        />
        <DashboardStatCard
          label="Confirmadas"
          value={dashboard.stats.confirmedAssignments}
          icon={CheckCircle2}
        />
        <DashboardStatCard
          label="Pendientes"
          value={dashboard.stats.pendingConfirmations}
          icon={ClipboardCheck}
        />
        <DashboardStatCard
          label="Rechazos"
          value={dashboard.stats.declinedAssignments}
          icon={AlertTriangle}
        />
        <DashboardStatCard
          label="Vacantes"
          value={dashboard.stats.openSlots}
          icon={Sparkles}
        />
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)]">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Horario de hoy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {dashboard.todaysAssignments.length ? (
              dashboard.todaysAssignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/admin/assignments/${assignment.id}`}
                  aria-label={`Ver especificaciones de ${assignment.preachingPoint.name}, pareja ${assignment.pairNumber}`}
                  className="group block h-full rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <AssignmentCard
                    assignment={assignment}
                    className="transition-all duration-200 group-hover:border-primary/35 group-hover:bg-primary/[0.05] group-hover:shadow-[0_18px_48px_rgba(59,130,246,0.12)]"
                    action={
                      <div className="flex items-center justify-between border-t border-white/5 pt-3 text-sm font-medium text-primary">
                        <span>Ver especificaciones</span>
                        <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    }
                  />
                </Link>
              ))
            ) : (
              <EmptyState
                title="Sin asignaciones hoy"
                description="El horario de hoy está despejado."
                className="md:col-span-2"
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="surface-panel">
            <CardHeader>
              <CardTitle>Confirmaciones pendientes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
              {dashboard.pendingConfirmations.slice(0, 3).map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </CardContent>
          </Card>
          <Card className="surface-panel">
            <CardHeader>
              <CardTitle>Reemplazos urgentes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
              {dashboard.urgentReplacements.length ? (
                dashboard.urgentReplacements.slice(0, 3).map((openSlot) => (
                  <div key={openSlot.assignmentId} className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="font-medium">{openSlot.preachingPointName}</p>
                    <p className="text-sm text-muted-foreground">
                      {openSlot.urgencyLabel} •{" "}
                      {openSlot.missingPositions
                        .map((position) => VOLUNTEER_POSITION_LABELS[position])
                        .join(" y ")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No hay reemplazos urgentes.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
