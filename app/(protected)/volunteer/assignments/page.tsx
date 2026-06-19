import Link from "next/link";
import { VolunteerAssignmentCard } from "@/components/volunteer/volunteer-assignment-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteerAssignmentRoleLabel } from "@/lib/volunteer-assignment";
import { getVolunteerDashboardData } from "@/services/dashboard.service";
import { CalendarDays, Sparkles, UserCircle2 } from "lucide-react";

type VolunteerAssignmentList = Awaited<
  ReturnType<typeof getVolunteerDashboardData>
>["pendingConfirmations"];

export default async function VolunteerAssignmentsPage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const volunteerProfileId = session.user.volunteerProfileId;
  const dashboard = await getVolunteerDashboardData(volunteerProfileId);
  const primaryAssignments = dashboard.upcomingAssignments.filter(
    (assignment) =>
      getVolunteerAssignmentRoleLabel(assignment, volunteerProfileId) ===
      "Titular"
  );
  const replacementAssignments = dashboard.upcomingAssignments.filter(
    (assignment) =>
      getVolunteerAssignmentRoleLabel(assignment, volunteerProfileId) ===
      "Suplente"
  );

  return (
    <div className="space-y-6">
      <section className="surface-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0 space-y-2">
          <h1 className="font-heading text-3xl font-semibold">
            Mis asignaciones
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Revisa tus turnos pendientes, confirmados y anteriores. Los turnos
            pendientes muestran los botones para responder.
          </p>
        </div>
        <div className="grid gap-2 sm:flex sm:items-center">
          {dashboard.openSlots.length ? (
            <Button className="w-full sm:w-auto" asChild>
              <Link href="/volunteer/open-slots">
                <Sparkles className="h-4 w-4" />
                Ver vacantes
              </Link>
            </Button>
          ) : null}
          <Button variant="secondary" className="w-full sm:w-auto" asChild>
            <Link href="/volunteer/availability">
              <UserCircle2 className="h-4 w-4" />
              Disponibilidad
            </Link>
          </Button>
        </div>
      </section>

      <AssignmentSection
        title="Pendientes de respuesta"
        description="Confirma o avisa si no puedes asistir."
        assignments={dashboard.pendingConfirmations}
        volunteerProfileId={volunteerProfileId}
        remindersByAssignmentId={dashboard.remindersByAssignmentId}
        showResponseActions
        emptyText="No tienes asignaciones pendientes de respuesta."
      />
      <AssignmentSection
        title="Confirmadas"
        description="Turnos próximos que ya quedaron registrados."
        assignments={dashboard.confirmedAssignments}
        volunteerProfileId={volunteerProfileId}
        remindersByAssignmentId={dashboard.remindersByAssignmentId}
        emptyText="No hay asignaciones confirmadas próximas."
      />
      <section className="grid gap-6 xl:grid-cols-2">
        <AssignmentSection
          title="Como titular"
          description="Turnos donde apareces como voluntario titular."
          assignments={primaryAssignments}
          volunteerProfileId={volunteerProfileId}
          remindersByAssignmentId={dashboard.remindersByAssignmentId}
          emptyText="No tienes turnos próximos como titular."
          compact
        />
        <AssignmentSection
          title="Como suplente"
          description="Turnos donde cubres o fuiste invitado como suplente."
          assignments={replacementAssignments}
          volunteerProfileId={volunteerProfileId}
          remindersByAssignmentId={dashboard.remindersByAssignmentId}
          emptyText="No tienes turnos próximos como suplente."
          compact
        />
      </section>
      <AssignmentSection
        title="Historial"
        description="Turnos anteriores registrados en tu perfil."
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
  description,
  assignments,
  volunteerProfileId,
  remindersByAssignmentId,
  showResponseActions = false,
  compact = false,
  emptyText
}: {
  title: string;
  description: string;
  assignments: VolunteerAssignmentList;
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
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
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
          <p className="rounded-lg border border-dashed border-border/70 bg-background/25 px-4 py-6 text-sm text-muted-foreground lg:col-span-2">
            {emptyText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
