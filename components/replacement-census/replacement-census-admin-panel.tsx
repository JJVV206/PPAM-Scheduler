"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { ClipboardEdit, MailCheck, TimerReset, Users } from "lucide-react";

import { ReplacementCensusForm } from "@/components/replacement-census/replacement-census-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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
  DAY_LABELS,
  DAYS_OF_WEEK,
  TIME_SLOT_DEFINITIONS
} from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import type { DayOfWeek, TimeSlot } from "@/types/domain";

type ReplacementCensusAdminPanelProps = {
  selectedWeekStart: string;
  availableWeeks: Array<{
    id: string;
    label: string;
    startDate: string;
  }>;
  census: {
    id: string;
    status: string;
    sentAt?: Date | null;
    closesAt: Date;
    createdAt: Date;
  } | null;
  stats: {
    totalResponses: number;
    submittedResponses: number;
    pendingResponses: number;
    declinedResponses: number;
  };
  responses: Array<{
    id: string;
    volunteerName: string;
    volunteerEmail: string;
    status: string;
    sentAt?: Date | null;
    respondedAt?: Date | null;
    expiresAt: Date;
    emailAttempts: number;
    availability: Array<{
      date: Date;
      dayOfWeek: DayOfWeek;
      timeSlot?: TimeSlot | null;
      available: boolean;
      notes?: string | null;
    }>;
  }>;
};

const responseStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  SUBMITTED: "Respondido",
  DECLINED: "No disponible",
  EXPIRED: "Expirado",
  FAILED: "Falló email"
};

function statusVariant(status: string) {
  if (status === "SUBMITTED") return "success" as const;
  if (status === "DECLINED" || status === "EXPIRED") return "warning" as const;
  if (status === "FAILED") return "danger" as const;
  return "default" as const;
}

function buildWeekDays(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`);
  return DAYS_OF_WEEK.map((dayOfWeek, index) => ({
    date: addDays(start, index).toISOString().slice(0, 10),
    dayOfWeek
  }));
}

function summarizeAvailability(
  availability: ReplacementCensusAdminPanelProps["responses"][number]["availability"]
) {
  if (!availability.length) {
    return "Sin disponibilidad confirmada";
  }

  const grouped = new Map<string, typeof availability>();
  for (const item of availability) {
    const key = item.date.toISOString().slice(0, 10);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return Array.from(grouped.entries())
    .map(([, rows]) => {
      const dayOfWeek = rows[0].dayOfWeek;
      const availableRows = rows.filter((row) => row.available);
      if (!availableRows.length) {
        return `${DAY_LABELS[dayOfWeek]}: no`;
      }

      const slots = availableRows
        .map((row) =>
          row.timeSlot ? TIME_SLOT_DEFINITIONS[row.timeSlot].shortLabel : null
        )
        .filter(Boolean);

      return slots.length
        ? `${DAY_LABELS[dayOfWeek]}: ${slots.join(", ")}`
        : `${DAY_LABELS[dayOfWeek]}: disponible`;
    })
    .join(" · ");
}

function StatCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="surface-elevated">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="bg-primary/12 flex h-9 w-9 items-center justify-center rounded-lg text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-heading text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReplacementCensusAdminPanel({
  selectedWeekStart,
  availableWeeks,
  census,
  stats,
  responses
}: ReplacementCensusAdminPanelProps) {
  const router = useRouter();
  const [editingResponseId, setEditingResponseId] = useState<string | null>(
    null
  );
  const selectedResponse = responses.find(
    (response) => response.id === editingResponseId
  );
  const weekDays = buildWeekDays(selectedWeekStart);

  return (
    <div className="space-y-4">
      <section className="surface-panel px-4 py-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
              Suplentes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Censo semanal y disponibilidad confirmada por fecha.
            </p>
          </div>
          <div className="w-full lg:max-w-xs">
            <Select
              value={selectedWeekStart}
              onValueChange={(value) =>
                router.push(`/admin/replacements?weekStart=${value}`)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona semana" />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((week) => (
                  <SelectItem key={week.id} value={week.startDate}>
                    {week.label} ·{" "}
                    {format(new Date(`${week.startDate}T12:00:00`), "d MMM", {
                      locale: es
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          icon={Users}
          label="Suplentes invitados"
          value={stats.totalResponses}
        />
        <StatCard
          icon={MailCheck}
          label="Respondieron"
          value={stats.submittedResponses}
        />
        <StatCard
          icon={TimerReset}
          label="Pendientes"
          value={stats.pendingResponses}
        />
        <StatCard
          icon={ClipboardEdit}
          label="No disponibles"
          value={stats.declinedResponses}
        />
      </div>

      <Card className="surface-panel">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold">
                Estado del censo
              </h2>
              <p className="text-sm text-muted-foreground">
                {census
                  ? `Cierra ${formatDisplayDate(census.closesAt, "d 'de' MMMM, HH:mm")}.`
                  : "No hay censo abierto para esta semana."}
              </p>
            </div>
            {census ? (
              <Badge variant={census.status === "OPEN" ? "success" : "warning"}>
                {census.status}
              </Badge>
            ) : null}
          </div>

          {responses.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Suplente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Disponibilidad</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((response) => (
                    <TableRow key={response.id}>
                      <TableCell>
                        <p className="font-medium">{response.volunteerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {response.volunteerEmail}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(response.status)}>
                          {responseStatusLabels[response.status] ??
                            response.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[28rem] text-sm text-muted-foreground">
                        {summarizeAvailability(response.availability)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {response.respondedAt
                          ? `Respondió ${formatDisplayDate(
                              response.respondedAt,
                              "d MMM, HH:mm"
                            )}`
                          : response.sentAt
                            ? `Enviado ${formatDisplayDate(
                                response.sentAt,
                                "d MMM, HH:mm"
                              )}`
                            : "Pendiente de envío"}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingResponseId(response.id)}
                        >
                          <ClipboardEdit className="h-4 w-4" />
                          Registrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
              No hay respuestas de censo para esta semana.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedResponse)}
        onOpenChange={(open) => {
          if (!open) setEditingResponseId(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Registrar disponibilidad de {selectedResponse?.volunteerName}
            </DialogTitle>
            <DialogDescription>
              Usa este formulario cuando el suplente respondió fuera de la app.
            </DialogDescription>
          </DialogHeader>
          {selectedResponse ? (
            <ReplacementCensusForm
              title="Disponibilidad manual"
              description="Actualiza los 7 días del censo semanal para este suplente."
              submitUrl={`/api/replacement-census/responses/${selectedResponse.id}`}
              method="PATCH"
              weekDays={weekDays}
              compact
              initialAvailability={selectedResponse.availability.map(
                (item) => ({
                  date: item.date.toISOString().slice(0, 10),
                  dayOfWeek: item.dayOfWeek,
                  timeSlot: item.timeSlot,
                  available: item.available,
                  notes: item.notes
                })
              )}
              onSaved={() => setEditingResponseId(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
