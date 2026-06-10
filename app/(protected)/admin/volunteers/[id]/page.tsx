import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, LifeBuoy } from "lucide-react";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import { EmptyState } from "@/components/forms/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/utils";
import { VolunteerProfileCard } from "@/components/volunteers/volunteer-profile-card";
import { getVolunteer } from "@/services/volunteer.service";
import { getVolunteerHistory } from "@/services/assignment.service";

type AdminVolunteerProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminVolunteerProfilePage({
  params
}: AdminVolunteerProfilePageProps) {
  try {
    const { id } = await params;
    const [volunteer, history] = await Promise.all([
      getVolunteer(id),
      getVolunteerHistory(id)
    ]);

    const confirmedAssignments = history.filter((assignment) =>
      ["CONFIRMED", "COMPLETED"].includes(assignment.status)
    ).length;
    const pendingAssignments = history.filter(
      (assignment) => assignment.status === "PENDING_CONFIRMATION"
    ).length;
    const replacementAssignments = history.filter(
      (assignment) =>
        assignment.status === "NEEDS_REPLACEMENT" ||
        assignment.warnings.includes("Se requiere reemplazo")
    ).length;

    return (
      <div className="flex min-h-full flex-col gap-5 pb-6">
        <div className="surface-panel rounded-[28px] px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <Button variant="ghost" size="sm" asChild className="w-fit">
                <Link href="/admin/volunteers">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a voluntarios
                </Link>
              </Button>
              <div>
                <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
                  {volunteer.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Revisa su perfil, seguimiento y todas las asignaciones
                  registradas.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <VolunteerMetricCard
                icon={ClipboardList}
                label="Asignaciones"
                value={history.length}
              />
              <VolunteerMetricCard
                icon={CheckCircle2}
                label="Confirmadas"
                value={confirmedAssignments}
                tone="success"
              />
              <VolunteerMetricCard
                icon={AlertTriangle}
                label="Pendientes"
                value={pendingAssignments}
                tone="warning"
              />
              <VolunteerMetricCard
                icon={LifeBuoy}
                label="Reemplazos"
                value={replacementAssignments}
                tone="danger"
              />
            </div>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]">
          <VolunteerProfileCard volunteer={volunteer} />

          <div className="min-w-0 space-y-6">
            <Card className="surface-panel min-w-0 overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle>Historial de asignaciones</CardTitle>
                <CardDescription>
                  Accede al detalle de cada asignación y revisa el seguimiento del
                  voluntario en el tiempo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {history.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        action={
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                {formatDisplayDate(
                                  assignment.date,
                                  "EEEE d 'de' MMM"
                                )}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Pareja {assignment.pairNumber}
                              </p>
                            </div>
                            <Button variant="secondary" size="sm" asChild>
                              <Link href={`/admin/assignments/${assignment.id}`}>
                                Ver detalle
                              </Link>
                            </Button>
                          </div>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Sin asignaciones registradas"
                    description="Este voluntario todavía no tiene historial. Cuando participe en una pareja, aparecerá aquí con acceso directo al detalle."
                    className="min-h-[240px] border border-white/5 bg-white/[0.02]"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}

type VolunteerMetricCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger";
};

function VolunteerMetricCard({
  icon: Icon,
  label,
  value,
  tone = "default"
}: VolunteerMetricCardProps) {
  const toneMap = {
    default:
      "border-white/5 bg-white/[0.03] text-primary",
    success:
      "border-success/15 bg-success/10 text-success",
    warning:
      "border-warning/15 bg-warning/10 text-warning",
    danger:
      "border-danger/15 bg-danger/10 text-danger"
  } as const;

  return (
    <div className="min-w-0 rounded-[24px] border border-white/5 bg-white/[0.03] px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="font-heading text-3xl font-semibold text-foreground">
            {value}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-2.5 ${toneMap[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
