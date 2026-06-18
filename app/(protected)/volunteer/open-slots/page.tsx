import { EmptyState } from "@/components/forms/empty-state";
import { OpenSlotCard } from "@/components/assignments/open-slot-card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteerDashboardData } from "@/services/dashboard.service";

export default async function VolunteerOpenSlotsPage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const dashboard = await getVolunteerDashboardData(
    session.user.volunteerProfileId
  );

  return dashboard.openSlots.length ? (
    <div className="space-y-6">
      <section className="surface-panel p-4 sm:p-5">
        <h1 className="font-heading text-3xl font-semibold">
          Vacantes compatibles
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Estos turnos necesitan cobertura y coinciden con tu disponibilidad.
          Acepta solo si puedes cubrir el horario completo.
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.openSlots.map((slot) => (
          <OpenSlotCard
            key={slot.assignmentId}
            openSlot={slot}
            mode="volunteer"
            currentVolunteerId={session.user.volunteerProfileId ?? undefined}
          />
        ))}
      </div>
    </div>
  ) : (
    <EmptyState
      title="No hay vacantes compatibles"
      description="Por ahora estás cubierto o no disponible para necesidades abiertas de reemplazo."
    />
  );
}
