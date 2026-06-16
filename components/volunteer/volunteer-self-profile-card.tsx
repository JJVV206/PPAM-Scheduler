import Link from "next/link";
import { CalendarClock, Mail, MapPin, Phone, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS
} from "@/lib/constants/domain";
import type { DayOfWeek, TimeSlot } from "@/types/domain";

type VolunteerSelfProfileCardProps = {
  volunteer: {
    name: string;
    email: string;
    phone?: string | null;
    active: boolean;
    temporaryUnavailable: boolean;
    canServeAsReplacement: boolean;
    preferredAreas: string[];
    availability?: Array<{
      dayOfWeek: DayOfWeek;
      timeSlot: TimeSlot;
      available?: boolean;
    }>;
  };
};

export function VolunteerSelfProfileCard({
  volunteer
}: VolunteerSelfProfileCardProps) {
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
    <Card className="surface-panel overflow-hidden">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-2xl">
                  {volunteer.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Perfil de voluntario
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={volunteer.active ? "success" : "outline"}>
                {volunteer.active ? "Activo" : "Inactivo"}
              </Badge>
              {volunteer.temporaryUnavailable ? (
                <Badge variant="warning">No disponible</Badge>
              ) : null}
              <Badge
                variant={
                  volunteer.canServeAsReplacement ? "success" : "secondary"
                }
              >
                {volunteer.canServeAsReplacement
                  ? "Puede servir como suplente"
                  : "Sin suplencias"}
              </Badge>
            </div>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/volunteer/availability">Actualizar disponibilidad</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 pt-2">
        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Contacto
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Correo</p>
                <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">
                  {volunteer.email}
                </p>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Teléfono</p>
                <p className="mt-1 break-words text-sm">
                  {volunteer.phone ?? "Sin teléfono registrado"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Preferencias
          </p>
          {volunteer.preferredAreas.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {volunteer.preferredAreas.map((area) => (
                <Badge key={area} variant="secondary" className="gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {area}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Sin preferencias registradas.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Disponibilidad general
          </p>
          {availabilityDays.length ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {availabilityDays.map(([dayOfWeek, slots]) => (
                <div
                  key={dayOfWeek}
                  className="rounded-2xl border border-white/5 bg-background/30 px-3 py-2.5"
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
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
              Sin disponibilidad recurrente registrada.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
