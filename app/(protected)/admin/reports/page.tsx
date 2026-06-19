import { BarChart3, MapPinned, Percent, Users2 } from "lucide-react";

import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportSummary } from "@/services/report.service";

export default async function AdminReportsPage() {
  const report = await getReportSummary();

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Reportes</h1>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Asignaciones"
          value={report.totalAssignments}
          icon={BarChart3}
        />
        <DashboardStatCard
          label="Tasa de confirmación"
          value={`${report.confirmationRate}%`}
          icon={Percent}
        />
        <DashboardStatCard
          label="Tasa de vacantes"
          value={`${report.openSlotRate}%`}
          icon={MapPinned}
        />
        <DashboardStatCard
          label="Cobertura de puntos"
          value={`${report.pointCoverageRate}%`}
          icon={Users2}
        />
      </section>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Voluntarios más activos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {report.volunteerParticipation.map((entry) => (
            <div
              key={entry.volunteerName}
              className="rounded-lg bg-background/35 p-4"
            >
              <p className="font-medium">{entry.volunteerName}</p>
              <p className="text-sm text-muted-foreground">
                {entry.count} asignaciones
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
