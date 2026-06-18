import Link from "next/link";
import { VolunteerAssignmentCard } from "@/components/volunteer/volunteer-assignment-card";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { EmptyState } from "@/components/forms/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import { getVolunteerAssignmentRoleLabel } from "@/lib/volunteer-assignment";
import { getVolunteerDashboardData } from "@/services/dashboard.service";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  MapPin,
  Sparkles
} from "lucide-react";

export default async function VolunteerDashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const volunteerProfileId = session.user.volunteerProfileId;
  const dashboard = await getVolunteerDashboardData(volunteerProfileId);
  const nextPendingAssignment = dashboard.pendingConfirmations[0];
  const nextConfirmedAssignment = dashboard.confirmedAssignments[0];
  const focusAssignment =
    nextPendingAssignment ??
    nextConfirmedAssignment ??
    dashboard.upcomingAssignments[0];
  const firstName = dashboard.volunteer.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Panel de voluntario</h1>

      <section className="surface-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">Hola, {firstName}</p>
            <h2 className="text-balance font-heading text-2xl font-semibold sm:text-3xl">
              {nextPendingAssignment
                ? "Tienes un turno esperando respuesta"
                : nextConfirmedAssignment
                  ? "Tu próximo turno está confirmado"
                  : "No tienes turnos próximos asignados"}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {nextPendingAssignment
                ? "Confirma si asistirás o avisa si no puedes para que se busque cobertura a tiempo."
                : nextConfirmedAssignment
                  ? "Revisa los datos del turno y los recordatorios antes de asistir."
                  : "Cuando recibas una asignación, aparecerá aquí con sus acciones principales."}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            {focusAssignment ? (
              <Button className="w-full sm:w-auto" asChild>
                <Link href={`/volunteer/assignments/${focusAssignment.id}`}>
                  {nextPendingAssignment ? "Responder ahora" : "Ver detalles"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {dashboard.openSlots.length ? (
              <Button
                variant={focusAssignment ? "secondary" : "default"}
                className="w-full sm:w-auto"
                asChild
              >
                <Link href="/volunteer/open-slots">
                  Ver vacantes
                  <Sparkles className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button variant="secondary" className="w-full sm:w-auto" asChild>
              <Link href="/volunteer/availability">
                Actualizar disponibilidad
              </Link>
            </Button>
          </div>
        </div>

        {focusAssignment ? (
          <div className="mt-4 grid gap-2 rounded-lg border border-border/70 bg-background/35 p-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Fecha
              </p>
              <p className="mt-1 font-medium">
                {formatDisplayDate(focusAssignment.date, "EEEE d 'de' MMM")}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Horario
              </p>
              <p className="mt-1 font-medium">
                {TIME_SLOT_DEFINITIONS[focusAssignment.timeSlot].label}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Punto
              </p>
              <p className="mt-1 font-medium">
                {focusAssignment.preachingPoint.name}
              </p>
            </div>
            <div className="sm:col-span-3">
              <Badge variant={nextPendingAssignment ? "warning" : "success"}>
                {getVolunteerAssignmentRoleLabel(
                  focusAssignment,
                  volunteerProfileId
                )}
              </Badge>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Pendientes"
          value={dashboard.pendingConfirmations.length}
          icon={AlertTriangle}
          hint="Necesitan respuesta"
        />
        <DashboardStatCard
          label="Confirmadas"
          value={dashboard.confirmedAssignments.length}
          icon={CheckCircle2}
          hint="Próximos turnos"
        />
        <DashboardStatCard
          label="Vacantes para ti"
          value={dashboard.openSlots.length}
          icon={Sparkles}
          hint="Puedes cubrir"
        />
        <DashboardStatCard
          label="Historial"
          value={dashboard.assignmentHistory.length}
          icon={History}
          hint="Turnos anteriores"
        />
      </section>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Turnos que necesitan respuesta</CardTitle>
          <CardDescription>
            Responde lo antes posible para confirmar o buscar cobertura.
          </CardDescription>
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
