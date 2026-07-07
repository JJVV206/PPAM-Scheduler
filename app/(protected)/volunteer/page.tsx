import Link from "next/link";
import { OpenSlotCard } from "@/components/assignments/open-slot-card";
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
import { getVolunteerDashboardModel } from "@/lib/volunteer-ui-config";
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
  const model = getVolunteerDashboardModel(dashboard);
  const { config } = model;
  const nextPendingAssignment = model.visiblePendingAssignments[0];
  const focusAssignment = model.focusAssignment;
  const focusOpenSlot = model.focusOpenSlot;
  const focusDate = focusAssignment?.date ?? focusOpenSlot?.date;
  const focusTimeSlot = focusAssignment?.timeSlot ?? focusOpenSlot?.timeSlot;
  const focusPointName =
    focusAssignment?.preachingPoint.name ?? focusOpenSlot?.preachingPointName;
  const firstName = dashboard.volunteer.name.split(" ")[0];
  const hasFocusPendingAssignment = Boolean(
    focusAssignment &&
    model.visiblePendingAssignments.some(
      (assignment) => assignment.id === focusAssignment.id
    )
  );
  const heroTitle = focusOpenSlot
    ? `${model.visibleOpenSlots.length} suplencia${
        model.visibleOpenSlots.length === 1 ? "" : "s"
      } compatible${model.visibleOpenSlots.length === 1 ? "" : "s"}`
    : focusAssignment
      ? hasFocusPendingAssignment
        ? config.serviceType === "REPLACEMENT"
          ? "Tienes una suplencia esperando respuesta"
          : "Tienes un turno esperando respuesta"
        : config.serviceType === "REPLACEMENT"
          ? "Tu próxima suplencia está confirmada"
          : "Tu próximo turno está confirmado"
      : config.copy.dashboardTitle;
  const heroDescription = focusOpenSlot
    ? "Revisa si puedes cubrir el horario completo antes de aceptar."
    : focusAssignment
      ? hasFocusPendingAssignment
        ? config.serviceType === "REPLACEMENT"
          ? "Responde si puedes cubrir esta suplencia para confirmar la cobertura."
          : "Confirma si asistirás o avisa si no puedes para que se busque cobertura a tiempo."
        : "Revisa los datos y los recordatorios antes de asistir."
      : config.copy.dashboardEmptyDescription;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Panel de voluntario</h1>

      <section className="surface-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">Hola, {firstName}</p>
            <h2 className="text-balance font-heading text-2xl font-semibold sm:text-3xl">
              {heroTitle}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {heroDescription}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            {focusAssignment ? (
              <Button className="w-full sm:w-auto" asChild>
                <Link href={`/volunteer/assignments/${focusAssignment.id}`}>
                  {hasFocusPendingAssignment
                    ? "Responder ahora"
                    : "Ver detalles"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {focusOpenSlot || model.visibleOpenSlots.length ? (
              <Button
                variant={focusAssignment ? "secondary" : "default"}
                className="w-full sm:w-auto"
                asChild
              >
                <Link href="/volunteer/open-slots">
                  Ver suplencias
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

        {focusAssignment || focusOpenSlot ? (
          <div className="mt-4 grid gap-2 rounded-lg border border-border/70 bg-background/35 p-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Fecha
              </p>
              <p className="mt-1 font-medium">
                {focusDate
                  ? formatDisplayDate(focusDate, "EEEE d 'de' MMM")
                  : null}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Horario
              </p>
              <p className="mt-1 font-medium">
                {focusTimeSlot
                  ? TIME_SLOT_DEFINITIONS[focusTimeSlot].label
                  : null}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Punto
              </p>
              <p className="mt-1 font-medium">{focusPointName}</p>
            </div>
            <div className="sm:col-span-3">
              <Badge
                variant={
                  focusOpenSlot
                    ? "default"
                    : nextPendingAssignment
                      ? "warning"
                      : "success"
                }
              >
                {focusOpenSlot
                  ? "Suplencia compatible"
                  : focusAssignment
                    ? getVolunteerAssignmentRoleLabel(
                        focusAssignment,
                        volunteerProfileId
                      )
                    : null}
              </Badge>
            </div>
          </div>
        ) : null}
      </section>

      {model.pendingReplacementCensus ? (
        <section className="surface-panel border-primary/30 bg-primary/[0.06] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">Pendiente</Badge>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Censo semanal de suplentes
                </span>
              </div>
              <h2 className="font-heading text-xl font-semibold">
                Indica tu disponibilidad para la semana del{" "}
                {formatDisplayDate(
                  model.pendingReplacementCensus.weekStart,
                  "d 'de' MMMM"
                )}
                {" al "}
                {formatDisplayDate(
                  model.pendingReplacementCensus.weekEnd,
                  "d 'de' MMMM"
                )}
              </h2>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Cierra el{" "}
                {formatDisplayDate(
                  model.pendingReplacementCensus.closesAt,
                  "d 'de' MMMM, h:mm a"
                )}
              </p>
            </div>
            <Button className="w-full sm:w-auto" asChild>
              <Link
                href={`/replacement-census/${encodeURIComponent(
                  model.pendingReplacementCensus.token
                )}`}
              >
                Responder censo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {config.canSeePrimaryAssignments ? (
          <DashboardStatCard
            label="Pendientes"
            value={model.primaryPendingAssignments.length}
            icon={AlertTriangle}
            hint="Necesitan respuesta"
          />
        ) : null}
        <DashboardStatCard
          label={
            config.serviceType === "REPLACEMENT" ? "Aceptadas" : "Confirmadas"
          }
          value={model.visibleConfirmedAssignments.length}
          icon={CheckCircle2}
          hint="Próximos turnos"
        />
        {config.canSeeOpenSlots ? (
          <DashboardStatCard
            label="Suplencias"
            value={model.visibleOpenSlots.length}
            icon={Sparkles}
            hint="Puedes cubrir"
          />
        ) : null}
        <DashboardStatCard
          label="Historial"
          value={model.visibleHistory.length}
          icon={History}
          hint="Turnos anteriores"
        />
      </section>

      {config.canSeePrimaryAssignments ||
      config.serviceType === "REPLACEMENT" ? (
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>{config.copy.pendingTitle}</CardTitle>
            <CardDescription>{config.copy.pendingDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {model.visiblePendingAssignments.length ? (
              model.visiblePendingAssignments.map((assignment) => (
                <VolunteerAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  volunteerProfileId={volunteerProfileId}
                  reminders={dashboard.remindersByAssignmentId[assignment.id]}
                  showResponseActions
                  variant={config.cardVariant}
                />
              ))
            ) : (
              <EmptyState
                title={config.copy.pendingEmpty}
                description={config.copy.dashboardEmptyDescription}
                className="lg:col-span-2"
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {config.canSeeOpenSlots ? (
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>{config.copy.openSlotsTitle}</CardTitle>
            <CardDescription>
              {config.copy.openSlotsDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {model.visibleOpenSlots.length ? (
              model.visibleOpenSlots
                .slice(0, 2)
                .map((slot) => (
                  <OpenSlotCard
                    key={slot.assignmentId}
                    openSlot={slot}
                    mode="volunteer"
                    currentVolunteerId={volunteerProfileId}
                  />
                ))
            ) : (
              <EmptyState
                title={config.copy.openSlotsEmptyTitle}
                description={config.copy.openSlotsEmptyDescription}
                className="lg:col-span-2"
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>{config.copy.confirmedTitle}</CardTitle>
            <CardDescription>
              {config.copy.confirmedDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {model.visibleConfirmedAssignments.length ? (
              model.visibleConfirmedAssignments
                .slice(0, 4)
                .map((assignment) => (
                  <VolunteerAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    volunteerProfileId={volunteerProfileId}
                    reminders={dashboard.remindersByAssignmentId[assignment.id]}
                    compact
                    variant={config.cardVariant}
                  />
                ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {config.copy.confirmedEmpty}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle>{config.copy.historyTitle}</CardTitle>
            <CardDescription>{config.copy.historyDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {model.visibleHistory.length ? (
              model.visibleHistory
                .slice(0, 4)
                .map((assignment) => (
                  <VolunteerAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    volunteerProfileId={volunteerProfileId}
                    reminders={dashboard.remindersByAssignmentId[assignment.id]}
                    compact
                    variant={config.cardVariant}
                  />
                ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {config.copy.historyEmpty}
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
