"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/assignments/status-badge";
import { FilterBar } from "@/components/forms/filter-bar";
import { SearchInput } from "@/components/forms/search-input";
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

type VolunteerTableProps = {
  volunteers: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    active: boolean;
    preferredAreas: string[];
  }>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
          volunteer.preferredAreas.join(" ")
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
    <div className="space-y-5">
      <FilterBar className="rounded-2xl">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, correo, teléfono o área"
          className="min-w-0 flex-1"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:items-center">
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
        <div className="flex items-center justify-between gap-3 md:ml-auto">
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
            <TableHead>Áreas preferidas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredVolunteers.length ? (
            filteredVolunteers.map((volunteer) => (
              <TableRow key={volunteer.id}>
                <TableCell className="font-medium">{volunteer.name}</TableCell>
                <TableCell>
                  <p>{volunteer.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {volunteer.phone ?? "Sin teléfono"}
                  </p>
                </TableCell>
                <TableCell>
                  {volunteer.preferredAreas.join(", ") || "Ninguna"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={volunteer.active ? "CONFIRMED" : "CANCELLED"} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" asChild>
                    <Link href={`/admin/volunteers/${volunteer.id}`}>Ver</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
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
