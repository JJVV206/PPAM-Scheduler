import { StatusBadge } from "@/components/assignments/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <TableHead>Point</TableHead>
          <TableHead>Area</TableHead>
          <TableHead>Active Slots</TableHead>
          <TableHead>Status</TableHead>
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
                : "No active windows"}
            </TableCell>
            <TableCell>
              <StatusBadge status={point.active ? "CONFIRMED" : "CANCELLED"} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
