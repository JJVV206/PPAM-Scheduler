import { BarChart3, MapPinned, Percent, Users2 } from "lucide-react";

import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportSummary } from "@/services/report.service";

export default async function AdminReportsPage() {
  const report = await getReportSummary();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard label="Assignments" value={report.totalAssignments} icon={BarChart3} />
        <DashboardStatCard label="Confirmation rate" value={`${report.confirmationRate}%`} icon={Percent} />
        <DashboardStatCard label="Open slot rate" value={`${report.openSlotRate}%`} icon={MapPinned} />
        <DashboardStatCard label="Point coverage" value={`${report.pointCoverageRate}%`} icon={Users2} />
      </section>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Most Active Volunteers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {report.volunteerParticipation.map((entry) => (
            <div key={entry.volunteerName} className="rounded-2xl bg-white/[0.03] p-4">
              <p className="font-medium">{entry.volunteerName}</p>
              <p className="text-sm text-muted-foreground">{entry.count} assignments</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
