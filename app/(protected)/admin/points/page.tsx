import { DataTable } from "@/components/forms/data-table";
import { PreachingPointTable } from "@/components/points/preaching-point-table";
import { CreatePointForm } from "@/features/points/create-point-form";
import { getPreachingPoints } from "@/services/point.service";

export default async function AdminPointsPage() {
  const points = await getPreachingPoints();

  return (
    <DataTable
      title="Preaching Points"
      description="Manage locations, active windows, and territory coverage."
      actions={<CreatePointForm />}
    >
      <PreachingPointTable
        points={points.map((point) => ({
          id: point.id,
          name: point.name,
          area: point.area,
          notes: point.notes,
          active: point.active,
          activeSlots: point.activeSlots.map((slot) => ({
            id: slot.id,
            dayOfWeek: slot.dayOfWeek,
            timeSlot: slot.timeSlot
          }))
        }))}
      />
    </DataTable>
  );
}
