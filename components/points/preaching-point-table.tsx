import { StatusBadge } from "@/components/assignments/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { PointFormDialog } from "@/features/points/point-form-dialog";
import { DAY_LABELS, TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import type { PreachingPointSummary } from "@/types/domain";

type PreachingPointTableProps = {
  points: PreachingPointSummary[];
};

export function PreachingPointTable({ points }: PreachingPointTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Punto</TableHead>
          <TableHead>Área</TableHead>
          <TableHead>Horarios activos</TableHead>
          <TableHead>Política</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map((point) => (
          <TableRow key={point.id}>
            <TableCell className="font-medium">{point.name}</TableCell>
            <TableCell>{point.area}</TableCell>
            <TableCell className="text-muted-foreground">
              {point.activeSlots.length
                ? point.activeSlots
                    .map(
                      (slot) =>
                        `${DAY_LABELS[slot.dayOfWeek]} ${TIME_SLOT_DEFINITIONS[slot.timeSlot].shortLabel}`
                    )
                    .join(", ")
                : "Sin horarios activos"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {point.activeSlots.length
                ? "Restringido a slots definidos"
                : "Disponible en cualquier franja mientras siga sin slots"}
            </TableCell>
            <TableCell>
              <StatusBadge status={point.active ? "CONFIRMED" : "CANCELLED"} />
            </TableCell>
            <TableCell className="text-right">
              <PointFormDialog
                point={point}
                trigger={<Button variant="secondary">Editar</Button>}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
