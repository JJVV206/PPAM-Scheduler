import {
  CalendarClock,
  CheckCircle2,
  Mail,
  NotebookPen,
  Phone,
  XCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS
} from "@/lib/constants/domain";
import type { DayOfWeek, TimeSlot } from "@/types/domain";

type VolunteerProfileCardProps = {
  volunteer: {
    name: string;
    email: string;
    phone?: string | null;
    active: boolean;
    temporaryUnavailable: boolean;
    confirmationCount: number;
    declineCount: number;
    noResponseCount: number;
    notes?: string | null;
    availability?: Array<{
      dayOfWeek: DayOfWeek;
      timeSlot: TimeSlot;
      available?: boolean;
    }>;
  };
};

export function VolunteerProfileCard({ volunteer }: VolunteerProfileCardProps) {
  const availabilityByDay =
    volunteer.availability
      ?.filter((item) => item.available !== false)
      .reduce<Partial<Record<DayOfWeek, TimeSlot[]>>>((accumulator, item) => {
        accumulator[item.dayOfWeek] ??= [];
        accumulator[item.dayOfWeek]?.push(item.timeSlot);
        return accumulator;
      }, {}) ?? {};
  const availabilityDays = DAYS_OF_WEEK.map(
    (day) => [day, availabilityByDay[day] ?? []] as [DayOfWeek, TimeSlot[]]
  ).filter(([, slots]) => slots.length > 0);

  return (
    <Card className="surface-panel h-fit min-w-0 self-start">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl">{volunteer.name}</CardTitle>
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
      <CardContent className="grid gap-3 p-5 pt-0 md:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 md:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Contacto
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Correo
                </p>
                <p className="mt-1 break-words text-sm leading-snug text-foreground [overflow-wrap:anywhere]">
                  {volunteer.email}
                </p>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Teléfono
                </p>
                <p className="mt-1 break-words text-sm leading-snug text-foreground">
                  {volunteer.phone ?? "Sin teléfono registrado"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 md:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Disponibilidad
          </p>
          {availabilityDays.length ? (
            <div className="mt-3 space-y-2">
              {availabilityDays.map(([dayOfWeek, slots]) => (
                <div
                  key={dayOfWeek}
                  className="rounded-2xl border border-white/5 bg-background/30 px-3 py-2"
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    {DAY_LABELS[dayOfWeek]}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <Badge key={slot} variant="secondary">
                        {TIME_SLOT_DEFINITIONS[slot].shortLabel}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
              Sin disponibilidad recurrente registrada.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 md:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Seguimiento
          </p>
          <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(104px,1fr))]">
            <div className="min-w-0 rounded-2xl border border-success/15 bg-success/10 p-2.5">
              <p className="text-[10px] uppercase leading-tight tracking-[0.06em] text-success/80">
                Confirm.
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <p className="text-xl font-semibold text-foreground">
                  {volunteer.confirmationCount}
                </p>
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-danger/15 bg-danger/10 p-2.5">
              <p className="text-[10px] uppercase leading-tight tracking-[0.06em] text-danger/80">
                Rechazos
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0 text-danger" />
                <p className="text-xl font-semibold text-foreground">
                  {volunteer.declineCount}
                </p>
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-warning/15 bg-warning/10 p-2.5">
              <p className="text-[10px] uppercase leading-tight tracking-[0.06em] text-warning/80">
                Sin resp.
              </p>
              <p className="mt-1.5 text-xl font-semibold text-foreground">
                {volunteer.noResponseCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 md:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Notas
          </p>
          <p className="mt-2 flex items-start gap-2 break-words text-sm leading-snug text-muted-foreground">
            <NotebookPen className="mt-0.5 h-4 w-4 shrink-0" />
            {volunteer.notes?.trim() || "Sin notas registradas."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
