"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FilterBar } from "@/components/forms/filter-bar";
import { SearchInput } from "@/components/forms/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  TIME_SLOT_DEFINITIONS,
  VOLUNTEER_SERVICE_TYPE_LABELS
} from "@/lib/constants/domain";
import type { DayOfWeek, TimeSlot, VolunteerServiceType } from "@/types/domain";

type VolunteerTableProps = {
  volunteers: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    active: boolean;
    preferredAreas: string[];
    canServeAsPrimary: boolean;
    canServeAsReplacement: boolean;
    serviceType: VolunteerServiceType;
    temporaryUnavailable: boolean;
    confirmationCount: number;
    declineCount: number;
    noResponseCount: number;
    availabilitySummary?: Array<{
      dayOfWeek: DayOfWeek;
      timeSlot: TimeSlot;
    }>;
  }>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getAvailabilityLines(
  availabilitySummary: VolunteerTableProps["volunteers"][number]["availabilitySummary"]
) {
  const byDay =
    availabilitySummary?.reduce<Partial<Record<DayOfWeek, TimeSlot[]>>>(
      (accumulator, item) => {
        accumulator[item.dayOfWeek] ??= [];
        accumulator[item.dayOfWeek]?.push(item.timeSlot);
        return accumulator;
      },
      {}
    ) ?? {};

  return DAYS_OF_WEEK.flatMap((day) => {
    const slots = byDay[day] ?? [];

    if (!slots.length) {
      return [];
    }

    const slotLabels = slots
      .map((slot) => TIME_SLOT_DEFINITIONS[slot].shortLabel)
      .join(", ");

    return [`${DAY_LABELS[day]}: ${slotLabels}`];
  });
}

export function VolunteerTable({ volunteers }: VolunteerTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");

  const areaOptions = useMemo(() => {
    const areas = new Set<string>();

    for (const volunteer of volunteers) {
      for (const area of volunteer.preferredAreas) {
        if (area.trim()) {
          areas.add(area);
        }
      }
    }

    return [...areas].sort((a, b) => a.localeCompare(b, "es"));
  }, [volunteers]);

  const filteredVolunteers = useMemo(() => {
    const normalizedSearch = normalize(search.trim());

    return volunteers.filter((volunteer) => {
      const searchableText = normalize(
        [
          volunteer.name,
          volunteer.email,
          volunteer.phone ?? "",
          volunteer.preferredAreas.join(" "),
          VOLUNTEER_SERVICE_TYPE_LABELS[volunteer.serviceType],
          volunteer.canServeAsPrimary ? "titular" : "",
          volunteer.canServeAsReplacement ? "suplente reemplazo" : "",
          getAvailabilityLines(volunteer.availabilitySummary).join(" ")
        ].join(" ")
      );
      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && volunteer.active) ||
        (statusFilter === "inactive" && !volunteer.active);
      const matchesArea =
        areaFilter === "all" || volunteer.preferredAreas.includes(areaFilter);

      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [areaFilter, search, statusFilter, volunteers]);

  const hasFilters =
    search.trim().length > 0 || statusFilter !== "all" || areaFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setAreaFilter("all");
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, correo, teléfono o área"
          className="min-w-0 flex-1"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las áreas</SelectItem>
              {areaOptions.map((area) => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 md:ml-auto">
          <p className="whitespace-nowrap text-sm text-muted-foreground">
            {filteredVolunteers.length} de {volunteers.length}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            Limpiar
          </Button>
        </div>
      </FilterBar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Disponibilidad</TableHead>
            <TableHead>Historial</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredVolunteers.length ? (
            filteredVolunteers.map((volunteer) => {
              const availabilityLines = getAvailabilityLines(
                volunteer.availabilitySummary
              );
              const visibleAvailability = availabilityLines.slice(0, 2);
              const hiddenAvailabilityCount =
                availabilityLines.length - visibleAvailability.length;

              return (
                <TableRow key={volunteer.id}>
                  <TableCell className="min-w-[180px]">
                    <p className="font-medium">{volunteer.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {volunteer.preferredAreas.join(", ") ||
                        "Sin áreas preferidas"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <p className="break-words text-sm [overflow-wrap:anywhere]">
                      {volunteer.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {volunteer.phone ?? "Sin teléfono"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={volunteer.active ? "success" : "outline"}>
                        {volunteer.active ? "Activo" : "Inactivo"}
                      </Badge>
                      {volunteer.temporaryUnavailable ? (
                        <Badge variant="warning">No disponible</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {VOLUNTEER_SERVICE_TYPE_LABELS[volunteer.serviceType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    {visibleAvailability.length ? (
                      <div className="space-y-1">
                        {visibleAvailability.map((line) => (
                          <p key={line} className="text-sm">
                            {line}
                          </p>
                        ))}
                        {hiddenAvailabilityCount > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            +{hiddenAvailabilityCount} más
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Sin disponibilidad
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="grid min-w-[130px] gap-1 text-xs text-muted-foreground">
                      <span>{volunteer.confirmationCount} confirmadas</span>
                      <span>{volunteer.declineCount} rechazos</span>
                      <span>{volunteer.noResponseCount} sin respuesta</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/admin/volunteers/${volunteer.id}`}>
                        Ver
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-32 text-center text-muted-foreground"
              >
                No hay voluntarios que coincidan con esos filtros.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
