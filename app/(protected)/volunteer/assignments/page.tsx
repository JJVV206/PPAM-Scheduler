import { EmptyState } from "@/components/forms/empty-state";
import { VolunteerAssignmentCard } from "@/components/volunteer/volunteer-assignment-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteerDashboardData } from "@/services/dashboard.service";

export default async function VolunteerAssignmentsPage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const volunteerProfileId = session.user.volunteerProfileId;
  const dashboard = await getVolunteerDashboardData(volunteerProfileId);

  if (
    !dashboard.pendingConfirmations.length &&
    !dashboard.confirmedAssignments.length &&
    !dashboard.assignmentHistory.length
  ) {
    return (
      <EmptyState
        title="Sin asignaciones todavía"
        description="Tus asignaciones pendientes, confirmadas e históricas aparecerán aquí."
      />
    );
  }

  return (
    <div className="space-y-6">
      <AssignmentSection
        title="Pendientes de respuesta"
        assignments={dashboard.pendingConfirmations}
        volunteerProfileId={volunteerProfileId}
        remindersByAssignmentId={dashboard.remindersByAssignmentId}
        showResponseActions
        emptyText="No tienes asignaciones pendientes de respuesta."
      />
      <AssignmentSection
        title="Confirmadas"
        assignments={dashboard.confirmedAssignments}
        volunteerProfileId={volunteerProfileId}
        remindersByAssignmentId={dashboard.remindersByAssignmentId}
        emptyText="No hay asignaciones confirmadas próximas."
      />
      <AssignmentSection
        title="Historial"
        assignments={dashboard.assignmentHistory}
        volunteerProfileId={volunteerProfileId}
        remindersByAssignmentId={dashboard.remindersByAssignmentId}
        emptyText="Todavía no hay asignaciones anteriores."
        compact
      />
    </div>
  );
}

function AssignmentSection({
  title,
  assignments,
  volunteerProfileId,
  remindersByAssignmentId,
  showResponseActions = false,
  compact = false,
  emptyText
}: {
  title: string;
  assignments: Awaited<
    ReturnType<typeof getVolunteerDashboardData>
  >["pendingConfirmations"];
  volunteerProfileId: string;
  remindersByAssignmentId: Awaited<
    ReturnType<typeof getVolunteerDashboardData>
  >["remindersByAssignmentId"];
  showResponseActions?: boolean;
  compact?: boolean;
  emptyText: string;
}) {
  return (
    <Card className="surface-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {assignments.length ? (
          assignments.map((assignment) => (
            <VolunteerAssignmentCard
              key={assignment.id}
              assignment={assignment}
              volunteerProfileId={volunteerProfileId}
              reminders={remindersByAssignmentId[assignment.id]}
              showResponseActions={showResponseActions}
              compact={compact}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground lg:col-span-2">
            {emptyText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
