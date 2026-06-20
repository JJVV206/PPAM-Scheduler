"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, UserCog } from "lucide-react";

import { FilterBar } from "@/components/forms/filter-bar";
import { SearchInput } from "@/components/forms/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  ROLE_LABELS,
  USER_ACCESS_STATUS_LABELS,
  VOLUNTEER_SERVICE_TYPE_LABELS,
  VOLUNTEER_SERVICE_TYPES
} from "@/lib/constants/domain";
import { cn } from "@/lib/utils";
import type { UserAccountDto } from "@/services/user.service";
import type {
  UserRole,
  VolunteerServiceType,
  VolunteerSummary
} from "@/types/domain";

type RoleFilter = "all" | UserRole;
type ServiceTypeFilter = "all" | VolunteerServiceType;

type UserDirectoryManagementProps = {
  accounts: UserAccountDto[];
  volunteers: VolunteerSummary[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getRoleBadgeVariant(role: UserRole) {
  return role === "ADMIN" ? "default" : "success";
}

function getAccessBadgeVariant(accessStatus: UserAccountDto["accessStatus"]) {
  if (accessStatus === "APPROVED") return "success";
  if (accessStatus === "PENDING_APPROVAL") return "warning";
  if (accessStatus === "REJECTED") return "danger";
  return "outline";
}

function getProfileStatus(account: UserAccountDto) {
  if (!account.volunteerProfile) {
    return account.role === "ADMIN"
      ? "Sin perfil voluntario"
      : "Perfil pendiente";
  }

  if (account.role === "ADMIN") {
    return "Perfil voluntario pausado";
  }

  if (account.volunteerProfile.active) {
    return account.volunteerProfile.temporaryUnavailable
      ? "Voluntario no disponible"
      : "Perfil voluntario activo";
  }

  return "Perfil voluntario inactivo";
}

function getVolunteerSummaryText(volunteer?: VolunteerSummary) {
  if (!volunteer) {
    return "Sin historial operativo";
  }

  return `${volunteer.confirmationCount} confirmadas · ${volunteer.declineCount} rechazos · ${volunteer.noResponseCount} sin respuesta`;
}

function getVolunteerServiceTypeText(volunteer?: VolunteerSummary) {
  if (!volunteer) {
    return "Sin tipo operativo";
  }

  return VOLUNTEER_SERVICE_TYPE_LABELS[volunteer.serviceType];
}

export function UserDirectoryManagement({
  accounts,
  volunteers
}: UserDirectoryManagementProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [serviceTypeFilter, setServiceTypeFilter] =
    useState<ServiceTypeFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({
    canServeAsPrimary: true,
    canServeAsReplacement: false
  });
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const volunteersByUserId = useMemo(() => {
    return new Map(
      volunteers.map((volunteer) => [volunteer.userId, volunteer])
    );
  }, [volunteers]);

  const approvedAccounts = useMemo(
    () => accounts.filter((account) => account.accessStatus === "APPROVED"),
    [accounts]
  );

  const activeAdminCount = useMemo(
    () =>
      approvedAccounts.filter(
        (account) => account.role === "ADMIN" && account.active
      ).length,
    [approvedAccounts]
  );

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = normalize(search.trim());

    return approvedAccounts.filter((account) => {
      const volunteer = volunteersByUserId.get(account.id);
      const searchableText = normalize(
        [
          account.name,
          account.email,
          account.phone,
          ROLE_LABELS[account.role],
          USER_ACCESS_STATUS_LABELS[account.accessStatus],
          getProfileStatus(account),
          getVolunteerServiceTypeText(volunteer),
          volunteer?.canServeAsPrimary ? "titular puede servir titular" : "",
          volunteer?.canServeAsReplacement
            ? "suplente reemplazo puede servir suplente"
            : "",
          volunteer?.preferredAreas.join(" ") ?? ""
        ].join(" ")
      );
      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      const matchesServiceType =
        serviceTypeFilter === "all" ||
        volunteer?.serviceType === serviceTypeFilter;

      return matchesSearch && matchesRole && matchesServiceType;
    });
  }, [
    approvedAccounts,
    roleFilter,
    search,
    serviceTypeFilter,
    volunteersByUserId
  ]);

  const selectedAccount = selectedUserId
    ? approvedAccounts.find((account) => account.id === selectedUserId)
    : null;
  const selectedVolunteer = selectedAccount
    ? volunteersByUserId.get(selectedAccount.id)
    : undefined;
  const hasFilters =
    search.trim().length > 0 ||
    roleFilter !== "all" ||
    serviceTypeFilter !== "all";
  const isSelectedPending =
    !!selectedAccount && pendingUserId === selectedAccount.id;
  const isOnlyActiveAdmin =
    !!selectedAccount &&
    selectedAccount.role === "ADMIN" &&
    selectedAccount.active &&
    activeAdminCount === 1;
  const roleChangeDisabled =
    !selectedAccount ||
    isSelectedPending ||
    !selectedAccount.active ||
    selectedAccount.accessStatus !== "APPROVED";
  const serviceDraftHasCapacity =
    serviceDraft.canServeAsPrimary || serviceDraft.canServeAsReplacement;
  const serviceChangeDisabled =
    !selectedAccount ||
    !selectedVolunteer ||
    selectedAccount.role !== "VOLUNTEER" ||
    isSelectedPending ||
    serviceSaving ||
    !selectedAccount.active ||
    selectedAccount.accessStatus !== "APPROVED";

  useEffect(() => {
    if (!selectedVolunteer) {
      setServiceDraft({
        canServeAsPrimary: true,
        canServeAsReplacement: false
      });
      return;
    }

    setServiceDraft({
      canServeAsPrimary: selectedVolunteer.canServeAsPrimary,
      canServeAsReplacement: selectedVolunteer.canServeAsReplacement
    });
  }, [
    selectedVolunteer?.canServeAsPrimary,
    selectedVolunteer?.canServeAsReplacement,
    selectedVolunteer?.id
  ]);

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setServiceTypeFilter("all");
  }

  function openProfile(accountId: string) {
    setFeedback(null);
    setSelectedUserId(accountId);
  }

  function closeProfile() {
    if (pendingUserId) return;

    setSelectedUserId(null);
    setFeedback(null);
  }

  async function handleRoleChange(account: UserAccountDto, nextRole: string) {
    if (account.role === nextRole) return;

    const role = nextRole as UserRole;
    setPendingUserId(account.id);
    setFeedback(null);

    const response = await fetch(`/api/admin/users/${account.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result?.error ?? "No se pudo actualizar el rol de la cuenta."
      });
      setPendingUserId(null);
      return;
    }

    setFeedback({
      tone: "success",
      text: `Rol actualizado para ${account.name}.`
    });
    setPendingUserId(null);
    router.refresh();
  }

  async function handleServiceTypeSave() {
    if (!selectedVolunteer || !selectedAccount) return;

    if (!serviceDraftHasCapacity) {
      setFeedback({
        tone: "error",
        text: "Selecciona al menos una capacidad operativa."
      });
      return;
    }

    setServiceSaving(true);
    setFeedback(null);

    const response = await fetch(`/api/volunteers/${selectedVolunteer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serviceDraft)
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result?.error ?? "No se pudo actualizar el tipo operativo."
      });
      setServiceSaving(false);
      return;
    }

    setFeedback({
      tone: "success",
      text: `Tipo operativo actualizado para ${selectedAccount.name}.`
    });
    setServiceSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, correo o teléfono"
          className="min-w-0 flex-1"
        />
        <Select
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as RoleFilter)}
        >
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
            <SelectItem value="VOLUNTEER">{ROLE_LABELS.VOLUNTEER}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={serviceTypeFilter}
          onValueChange={(value) =>
            setServiceTypeFilter(value as ServiceTypeFilter)
          }
        >
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Tipo operativo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {VOLUNTEER_SERVICE_TYPES.map((serviceType) => (
              <SelectItem key={serviceType} value={serviceType}>
                {VOLUNTEER_SERVICE_TYPE_LABELS[serviceType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between gap-2 md:ml-auto">
          <p className="whitespace-nowrap text-sm text-muted-foreground">
            {filteredAccounts.length} de {approvedAccounts.length}
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

      <div className="overflow-hidden rounded-lg border border-border/65 bg-background/20">
        <div className="hidden border-b border-border/60 bg-surface-elevated/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.25fr)_9rem_minmax(0,1fr)_8rem] lg:gap-3">
          <span>Usuario</span>
          <span>Rol</span>
          <span>Perfil</span>
          <span className="text-right">Acción</span>
        </div>

        <div className="max-h-[min(58vh,42rem)] overflow-y-auto">
          {filteredAccounts.length ? (
            <div className="divide-y divide-border/60">
              {filteredAccounts.map((account) => {
                const volunteer = volunteersByUserId.get(account.id);
                const isSelected = selectedUserId === account.id;

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => openProfile(account.id)}
                    className={cn(
                      "grid w-full gap-3 px-3 py-3 text-left transition hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,1.25fr)_9rem_minmax(0,1fr)_8rem] lg:items-center",
                      isSelected && "bg-secondary/45"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {account.name}
                      </p>
                      <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {account.email}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {account.phone || "Sin teléfono"} ·{" "}
                        {account.active ? "Cuenta activa" : "Cuenta inactiva"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(account.role)}>
                        {ROLE_LABELS[account.role]}
                      </Badge>
                      <Badge
                        variant={getAccessBadgeVariant(account.accessStatus)}
                      >
                        {USER_ACCESS_STATUS_LABELS[account.accessStatus]}
                      </Badge>
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {getProfileStatus(account)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getVolunteerServiceTypeText(volunteer)} ·{" "}
                        {getVolunteerSummaryText(volunteer)}
                      </p>
                    </div>

                    <span className="inline-flex items-center justify-start gap-2 text-sm font-semibold text-primary lg:justify-end">
                      <UserCog className="h-4 w-4" />
                      Ver perfil
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
              {approvedAccounts.length
                ? "No hay usuarios que coincidan con esos filtros."
                : "No hay usuarios aprobados para mostrar."}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!selectedAccount}
        onOpenChange={(open) => {
          if (!open) closeProfile();
        }}
      >
        <DialogContent className="max-w-2xl">
          {selectedAccount ? (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle>{selectedAccount.name}</DialogTitle>
                <DialogDescription>
                  Perfil de usuario aprobado y datos operativos de la cuenta.
                </DialogDescription>
              </DialogHeader>

              <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/25 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Contacto
                  </p>
                  <p className="mt-2 break-words text-sm text-foreground [overflow-wrap:anywhere]">
                    {selectedAccount.email}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedAccount.phone || "Sin teléfono"}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/25 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Estado
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge
                      variant={getAccessBadgeVariant(
                        selectedAccount.accessStatus
                      )}
                    >
                      {USER_ACCESS_STATUS_LABELS[selectedAccount.accessStatus]}
                    </Badge>
                    <Badge variant={getRoleBadgeVariant(selectedAccount.role)}>
                      {ROLE_LABELS[selectedAccount.role]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedAccount.active
                      ? "Cuenta activa"
                      : "Cuenta inactiva"}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/25 p-3 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Perfil voluntario
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    {getProfileStatus(selectedAccount)}
                  </p>
                  {selectedVolunteer ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {getVolunteerServiceTypeText(selectedVolunteer)}
                      </Badge>
                      {selectedVolunteer.canServeAsPrimary ? (
                        <Badge variant="outline">
                          Puede servir como titular
                        </Badge>
                      ) : null}
                      {selectedVolunteer.canServeAsReplacement ? (
                        <Badge variant="success">
                          Puede servir como suplente
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getVolunteerSummaryText(selectedVolunteer)}
                  </p>
                  {selectedVolunteer?.preferredAreas.length ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Áreas: {selectedVolunteer.preferredAreas.join(", ")}
                    </p>
                  ) : null}
                  {isOnlyActiveAdmin ? (
                    <p className="mt-2 text-sm text-warning">
                      Esta cuenta es el último administrador activo.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border/60 bg-background/25 p-3 sm:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Tipo operativo
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Define si esta cuenta sirve como titular, suplente o
                        ambos.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleServiceTypeSave()}
                      disabled={
                        serviceChangeDisabled || !serviceDraftHasCapacity
                      }
                    >
                      {serviceSaving ? "Guardando..." : "Guardar tipo"}
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label
                      className={cn(
                        "flex items-start gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5",
                        serviceChangeDisabled && "opacity-60"
                      )}
                    >
                      <Checkbox
                        checked={serviceDraft.canServeAsPrimary}
                        disabled={serviceChangeDisabled}
                        onCheckedChange={(checked) =>
                          setServiceDraft((current) => ({
                            ...current,
                            canServeAsPrimary: checked === true
                          }))
                        }
                      />
                      <span className="text-sm">Puede servir como titular</span>
                    </label>
                    <label
                      className={cn(
                        "flex items-start gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5",
                        serviceChangeDisabled && "opacity-60"
                      )}
                    >
                      <Checkbox
                        checked={serviceDraft.canServeAsReplacement}
                        disabled={serviceChangeDisabled}
                        onCheckedChange={(checked) =>
                          setServiceDraft((current) => ({
                            ...current,
                            canServeAsReplacement: checked === true
                          }))
                        }
                      />
                      <span className="text-sm">Puede servir como suplente</span>
                    </label>
                  </div>
                  {!serviceDraftHasCapacity ? (
                    <p className="mt-2 text-sm text-danger">
                      El perfil voluntario activo necesita al menos una
                      capacidad.
                    </p>
                  ) : null}
                  {selectedVolunteer?.canServeAsPrimary &&
                  !serviceDraft.canServeAsPrimary ? (
                    <p className="mt-2 text-sm text-warning">
                      No se modificarán asignaciones existentes; revisa futuras
                      asignaciones titulares antes de guardar.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border/60 bg-background/25 p-3 sm:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Delegar como
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Cambia el rol operativo de esta cuenta aprobada.
                      </p>
                    </div>
                    <Select
                      value={selectedAccount.role}
                      onValueChange={(role) =>
                        void handleRoleChange(selectedAccount, role)
                      }
                      disabled={roleChangeDisabled}
                    >
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue placeholder="Selecciona rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">
                          {ROLE_LABELS.ADMIN}
                        </SelectItem>
                        <SelectItem
                          value="VOLUNTEER"
                          disabled={isOnlyActiveAdmin}
                        >
                          {ROLE_LABELS.VOLUNTEER}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                {selectedAccount.volunteerProfile ? (
                  <Button asChild variant="secondary">
                    <Link
                      href={`/admin/volunteers/${selectedAccount.volunteerProfile.id}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Perfil voluntario
                    </Link>
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={closeProfile}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
