import { VolunteerAssignmentCard } from "@/components/volunteer/volunteer-assignment-card";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { EmptyState } from "@/components/forms/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteerDashboardData } from "@/services/dashboard.service";
import { AlertTriangle, CheckCircle2, History, Sparkles } from "lucide-react";

export default async function VolunteerDashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const volunteerProfileId = session.user.volunteerProfileId;
  const dashboard = await getVolunteerDashboardData(volunteerProfileId);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Panel de voluntario</h1>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Pendientes"
          value={dashboard.pendingConfirmations.length}
          icon={AlertTriangle}
        />
        <DashboardStatCard
          label="Confirmadas"
          value={dashboard.confirmedAssignments.length}
          icon={CheckCircle2}
        />
        <DashboardStatCard
          label="Vacantes para ti"
          value={dashboard.openSlots.length}
          icon={Sparkles}
        />
        <DashboardStatCard
          label="Historial"
          value={dashboard.assignmentHistory.length}
          icon={History}
        />
      </section>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Asignaciones pendientes de respuesta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {dashboard.pendingConfirmations.length ? (
            dashboard.pendingConfirmations.map((assignment) => (
              <VolunteerAssignmentCard
                key={assignment.id}
                assignment={assignment}
                volunteerProfileId={volunteerProfileId}
                reminders={dashboard.remindersByAssignmentId[assignment.id]}
                showResponseActions
              />
            ))
          ) : (
            <EmptyState
              title="Sin respuestas pendientes"
              description="No tienes asignaciones esperando confirmación."
              className="lg:col-span-2"
            />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Asignaciones confirmadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.confirmedAssignments.length ? (
              dashboard.confirmedAssignments
                .slice(0, 4)
                .map((assignment) => (
                  <VolunteerAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    volunteerProfileId={volunteerProfileId}
                    reminders={dashboard.remindersByAssignmentId[assignment.id]}
                    compact
                  />
                ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Tus asignaciones confirmadas aparecerán aquí.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.assignmentHistory.length ? (
              dashboard.assignmentHistory
                .slice(0, 4)
                .map((assignment) => (
                  <VolunteerAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    volunteerProfileId={volunteerProfileId}
                    reminders={dashboard.remindersByAssignmentId[assignment.id]}
                    compact
                  />
                ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Tu historial se llenará cuando pasen tus primeras asignaciones.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
