import { OpenSlotCard } from "@/components/assignments/open-slot-card";
import { EmptyState } from "@/components/forms/empty-state";
import { getOpenSlots } from "@/services/assignment.service";

export default async function AdminOpenSlotsPage() {
  const openSlots = await getOpenSlots();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold">Vacantes</h1>
        <p className="text-sm text-muted-foreground">
          Cubre los voluntarios faltantes antes de que una asignación quede sin atender.
        </p>
      </div>
      {openSlots.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {openSlots.map((openSlot) => (
            <OpenSlotCard key={openSlot.assignmentId} openSlot={openSlot} mode="admin" />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Todo cubierto"
          description="No hay asignaciones abiertas que requieran reemplazo."
        />
      )}
    </div>
  );
}
