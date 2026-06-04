import { CarFront, Mail, Phone, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VolunteerProfileCardProps = {
  volunteer: {
    name: string;
    email: string;
    phone?: string | null;
    reliabilityScore: number;
    transportationNotes?: string | null;
    preferredAreas: string[];
  };
};

export function VolunteerProfileCard({ volunteer }: VolunteerProfileCardProps) {
  return (
    <Card className="surface-elevated">
      <CardHeader>
        <CardTitle>{volunteer.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {volunteer.email}
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {volunteer.phone ?? "Sin teléfono"}
          </p>
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Confiabilidad {Math.round(volunteer.reliabilityScore)}%
          </p>
          <p className="flex items-center gap-2">
            <CarFront className="h-4 w-4" />
            {volunteer.transportationNotes ?? "Sin notas de transporte"}
          </p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] p-4 text-sm text-muted-foreground">
          Áreas preferidas: {volunteer.preferredAreas.join(", ") || "Ninguna"}
        </div>
      </CardContent>
    </Card>
  );
}
