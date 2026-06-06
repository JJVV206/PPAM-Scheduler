import {
  CarFront,
  CheckCircle2,
  Mail,
  NotebookPen,
  Phone,
  ShieldCheck,
  XCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VolunteerProfileCardProps = {
  volunteer: {
    name: string;
    email: string;
    phone?: string | null;
    active: boolean;
    temporaryUnavailable: boolean;
    reliabilityScore: number;
    confirmationCount: number;
    declineCount: number;
    noResponseCount: number;
    notes?: string | null;
    transportationNotes?: string | null;
    preferredAreas: string[];
  };
};

export function VolunteerProfileCard({ volunteer }: VolunteerProfileCardProps) {
  return (
    <Card className="surface-elevated h-fit min-w-0">
      <CardHeader className="p-6 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-2xl">{volunteer.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Perfil operativo del voluntario
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={volunteer.active ? "success" : "outline"}>
              {volunteer.active ? "Activo" : "Inactivo"}
            </Badge>
            {volunteer.temporaryUnavailable ? (
              <Badge variant="warning">No disponible</Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-0">
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Correo
                </p>
                <p className="mt-1 break-all text-sm text-foreground">
                  {volunteer.email}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Teléfono
                </p>
                <p className="mt-1 break-words text-sm text-foreground">
                  {volunteer.phone ?? "Sin teléfono registrado"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Confiabilidad
            </p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {Math.round(volunteer.reliabilityScore)}%
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Transporte
            </p>
            <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
              <CarFront className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="break-words">
                {volunteer.transportationNotes ?? "Sin notas registradas"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-success/15 bg-success/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-success/80">
              Confirmaciones
            </p>
            <div className="mt-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              <p className="text-2xl font-semibold text-foreground">
                {volunteer.confirmationCount}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-danger/15 bg-danger/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-danger/80">
              Rechazos
            </p>
            <div className="mt-2 flex items-center gap-2">
              <XCircle className="h-5 w-5 shrink-0 text-danger" />
              <p className="text-2xl font-semibold text-foreground">
                {volunteer.declineCount}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-warning/15 bg-warning/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-warning/80">
              Sin respuesta
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {volunteer.noResponseCount}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Áreas preferidas
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {volunteer.preferredAreas.length ? (
              volunteer.preferredAreas.map((area) => (
                <Badge key={area} variant="secondary" className="tracking-normal">
                  {area}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin preferencias registradas.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Notas
          </p>
          <p className="mt-2 flex items-start gap-2 break-words text-sm text-muted-foreground">
            <NotebookPen className="mt-0.5 h-4 w-4 shrink-0" />
            {volunteer.notes?.trim() || "Sin notas registradas."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
