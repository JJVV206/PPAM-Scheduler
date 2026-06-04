import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Sparkles
} from "lucide-react";

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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

      <section className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Horario de hoy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {dashboard.todaysAssignments.length ? (
              dashboard.todaysAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
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
            <CardContent className="space-y-4">
              {dashboard.pendingConfirmations.slice(0, 3).map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </CardContent>
          </Card>
          <Card className="surface-panel">
            <CardHeader>
              <CardTitle>Reemplazos urgentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
