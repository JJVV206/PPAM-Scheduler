import { AssignmentCard } from "@/components/assignments/assignment-card";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { EmptyState } from "@/components/forms/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteerDashboardData } from "@/services/dashboard.service";
import { AlertTriangle, CalendarDays, CheckCircle2, Sparkles } from "lucide-react";

export default async function VolunteerDashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const dashboard = await getVolunteerDashboardData(session.user.volunteerProfileId);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Próximas"
          value={dashboard.upcomingAssignments.length}
          icon={CalendarDays}
        />
        <DashboardStatCard
          label="Confirmaciones pendientes"
          value={dashboard.pendingConfirmations.length}
          icon={AlertTriangle}
        />
        <DashboardStatCard
          label="Vacantes para ti"
          value={dashboard.openSlots.length}
          icon={Sparkles}
        />
        <DashboardStatCard
          label="Confiabilidad"
          value={`${Math.round(dashboard.volunteer.reliabilityScore)}%`}
          icon={CheckCircle2}
        />
      </section>
      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Próximas asignaciones</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {dashboard.upcomingAssignments.length ? (
            dashboard.upcomingAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))
          ) : (
            <EmptyState
              title="Nada programado"
              description="No tienes próximas asignaciones por ahora."
              className="lg:col-span-2"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
