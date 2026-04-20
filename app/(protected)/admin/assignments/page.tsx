import { AssignmentDetailModal } from "@/components/assignments/assignment-detail-modal";
import { StatusBadge } from "@/components/assignments/status-badge";
import { DataTable } from "@/components/forms/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import { getAssignments } from "@/services/assignment.service";

export default async function AdminAssignmentsPage() {
  const assignments = await getAssignments();

  return (
    <DataTable
      title="Assignments"
      description="All scheduled, pending, replacement, and completed assignments."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Point</TableHead>
            <TableHead>Pair</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell>{formatDisplayDate(assignment.date, "EEE, MMM d")}</TableCell>
              <TableCell>{TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}</TableCell>
              <TableCell>{assignment.preachingPoint.name}</TableCell>
              <TableCell>
                {assignment.volunteers.map((item) => item.volunteer.name).join(" & ")}
              </TableCell>
              <TableCell>
                <StatusBadge status={assignment.status} />
              </TableCell>
              <TableCell className="text-right">
                <AssignmentDetailModal assignment={assignment} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTable>
  );
}
