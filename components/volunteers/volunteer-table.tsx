import Link from "next/link";

import { StatusBadge } from "@/components/assignments/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type VolunteerTableProps = {
  volunteers: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    active: boolean;
    reliabilityScore: number;
    preferredAreas: string[];
  }>;
};

export function VolunteerTable({ volunteers }: VolunteerTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Contacto</TableHead>
          <TableHead>Confiabilidad</TableHead>
          <TableHead>Áreas preferidas</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {volunteers.map((volunteer) => (
          <TableRow key={volunteer.id}>
            <TableCell className="font-medium">{volunteer.name}</TableCell>
            <TableCell>
              <p>{volunteer.email}</p>
              <p className="text-xs text-muted-foreground">{volunteer.phone ?? "Sin teléfono"}</p>
            </TableCell>
            <TableCell>{Math.round(volunteer.reliabilityScore)}%</TableCell>
            <TableCell>{volunteer.preferredAreas.join(", ") || "Ninguna"}</TableCell>
            <TableCell>
              <StatusBadge status={volunteer.active ? "CONFIRMED" : "CANCELLED"} />
            </TableCell>
            <TableCell className="text-right">
              <Button variant="secondary" asChild>
                <Link href={`/admin/volunteers/${volunteer.id}`}>Ver</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
