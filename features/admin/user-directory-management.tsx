"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eraser,
  ExternalLink,
  RotateCcw,
  Save,
  UserCog,
  UserX
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ROLE_LABELS,
  USER_ACCESS_STATUS_LABELS,
  VOLUNTEER_SERVICE_TYPE_LABELS,
  VOLUNTEER_SERVICE_TYPES
} from "@/lib/constants/domain";
import { cn, formatDisplayDate } from "@/lib/utils";
import type { UserAccountDto } from "@/services/user.service";
import type {
  UserRole,
  VolunteerServiceType,
  VolunteerSummary
} from "@/types/domain";

type RoleFilter = "all" | UserRole;
type AccessFilter = "all" | "APPROVED" | "SUSPENDED" | "REJECTED";
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

function isAnonymizedAccount(account: UserAccountDto) {
  return (
    account.email.startsWith("deleted+") &&
    account.email.endsWith("@ppam.local")
  );
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
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [serviceTypeFilter, setServiceTypeFilter] =
    useState<ServiceTypeFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({
    canServeAsPrimary: true,
    canServeAsReplacement: false
  });
  const [accessDialogAction, setAccessDialogAction] = useState<
    "SUSPEND" | "REACTIVATE" | null
  >(null);
  const [accessNote, setAccessNote] = useState("");
  const [reactivationDraft, setReactivationDraft] = useState({
    canServeAsPrimary: true,
    canServeAsReplacement: false
  });
  const [anonymizeAccount, setAnonymizeAccount] =
    useState<UserAccountDto | null>(null);
  const [anonymizeConfirmationEmail, setAnonymizeConfirmationEmail] =
    useState("");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const volunteersByUserId = useMemo(() => {
    return new Map(
      volunteers.map((volunteer) => [volunteer.userId, volunteer])
    );
  }, [volunteers]);

  const managedAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          ["APPROVED", "SUSPENDED", "REJECTED"].includes(
            account.accessStatus
          ) && !isAnonymizedAccount(account)
      ),
    [accounts]
  );

  const accountsForCurrentStatus = useMemo(
    () =>
      managedAccounts.filter((account) =>
        accessFilter === "all"
          ? account.accessStatus !== "REJECTED"
          : account.accessStatus === accessFilter
      ),
    [accessFilter, managedAccounts]
  );

  const activeAdminCount = useMemo(
    () =>
      managedAccounts.filter(
        (account) => account.role === "ADMIN" && account.active
      ).length,
    [managedAccounts]
  );

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = normalize(search.trim());

    return accountsForCurrentStatus.filter((account) => {
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
      const matchesAccess =
        accessFilter === "all" || account.accessStatus === accessFilter;
      const matchesServiceType =
        serviceTypeFilter === "all" ||
        volunteer?.serviceType === serviceTypeFilter;

      return (
        matchesSearch && matchesRole && matchesAccess && matchesServiceType
      );
    });
  }, [
    accessFilter,
    accountsForCurrentStatus,
    roleFilter,
    search,
    serviceTypeFilter,
    volunteersByUserId
  ]);

  const selectedAccount = selectedUserId
    ? managedAccounts.find((account) => account.id === selectedUserId)
    : null;
  const selectedVolunteer = selectedAccount
    ? volunteersByUserId.get(selectedAccount.id)
    : undefined;
  const hasFilters =
    search.trim().length > 0 ||
    accessFilter !== "all" ||
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
  const reactivationDraftHasCapacity =
    reactivationDraft.canServeAsPrimary ||
    reactivationDraft.canServeAsReplacement;
  const serviceChangeDisabled =
    !selectedAccount ||
    !selectedVolunteer ||
    selectedAccount.role !== "VOLUNTEER" ||
    isSelectedPending ||
    serviceSaving ||
    !selectedAccount.active ||
    selectedAccount.accessStatus !== "APPROVED";
  const nameDraftTrimmed = nameDraft.trim();
  const nameChangeDisabled =
    !selectedAccount ||
    nameSaving ||
    nameDraftTrimmed.length < 2 ||
    nameDraftTrimmed.length > 120 ||
    nameDraftTrimmed === selectedAccount.name.trim();
  const canSuspendAccount =
    !!selectedAccount &&
    selectedAccount.active &&
    selectedAccount.accessStatus === "APPROVED" &&
    !isOnlyActiveAdmin;
  const canReactivateAccount =
    !!selectedAccount &&
    !selectedAccount.active &&
    selectedAccount.accessStatus === "SUSPENDED";
  const canAnonymizeAccount =
    !!selectedAccount &&
    !selectedAccount.active &&
    selectedAccount.accessStatus !== "APPROVED" &&
    !isOnlyActiveAdmin;

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

  useEffect(() => {
    if (!selectedAccount) {
      setNameDraft("");
      return;
    }

    setNameDraft(selectedAccount.name);
    setReactivationDraft({
      canServeAsPrimary:
        selectedAccount.volunteerProfile?.canServeAsPrimary ?? true,
      canServeAsReplacement:
        selectedAccount.volunteerProfile?.canServeAsReplacement ?? false
    });
  }, [
    selectedAccount?.id,
    selectedAccount?.name,
    selectedAccount?.volunteerProfile?.canServeAsPrimary,
    selectedAccount?.volunteerProfile?.canServeAsReplacement
  ]);

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setAccessFilter("all");
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

  async function handleNameSave() {
    if (!selectedAccount || nameChangeDisabled) return;

    setNameSaving(true);
    setFeedback(null);

    const response = await fetch(`/api/admin/users/${selectedAccount.id}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraftTrimmed })
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result?.error ?? "No se pudo actualizar el nombre."
      });
      setNameSaving(false);
      return;
    }

    setFeedback({
      tone: "success",
      text: "Nombre actualizado."
    });
    setNameSaving(false);
    router.refresh();
  }

  async function handleAccessChange() {
    if (!selectedAccount || !accessDialogAction) return;

    if (
      accessDialogAction === "REACTIVATE" &&
      selectedAccount.role === "VOLUNTEER" &&
      !reactivationDraftHasCapacity
    ) {
      setFeedback({
        tone: "error",
        text: "Selecciona al menos una capacidad operativa."
      });
      return;
    }

    setPendingUserId(selectedAccount.id);
    setFeedback(null);

    const response = await fetch(
      `/api/admin/users/${selectedAccount.id}/access`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: accessDialogAction,
          note: accessNote,
          ...(accessDialogAction === "REACTIVATE"
            ? reactivationDraft
            : {})
        })
      }
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result?.error ?? "No se pudo actualizar el acceso."
      });
      setPendingUserId(null);
      return;
    }

    setFeedback({
      tone: "success",
      text:
        accessDialogAction === "SUSPEND"
          ? "Cuenta suspendida."
          : "Cuenta reactivada."
    });
    setPendingUserId(null);
    setAccessDialogAction(null);
    setAccessNote("");
    router.refresh();
  }

  async function handleAnonymize() {
    if (!anonymizeAccount) return;

    setPendingUserId(anonymizeAccount.id);
    setFeedback(null);

    const response = await fetch(
      `/api/admin/users/${anonymizeAccount.id}/anonymize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationEmail: anonymizeConfirmationEmail
        })
      }
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result?.error ?? "No se pudo anonimizar la cuenta."
      });
      setPendingUserId(null);
      return;
    }

    setFeedback({
      tone: "success",
      text: "Cuenta anonimizada y correo liberado."
    });
    setPendingUserId(null);
    setAnonymizeAccount(null);
    setAnonymizeConfirmationEmail("");
    setSelectedUserId(null);
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
    <div
      role="region"
      aria-label="Directorio de usuarios"
      className="space-y-4"
    >
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
          value={accessFilter}
          onValueChange={(value) => setAccessFilter(value as AccessFilter)}
        >
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estados operativos</SelectItem>
            <SelectItem value="APPROVED">
              {USER_ACCESS_STATUS_LABELS.APPROVED}
            </SelectItem>
            <SelectItem value="SUSPENDED">
              {USER_ACCESS_STATUS_LABELS.SUSPENDED}
            </SelectItem>
            <SelectItem value="REJECTED">
              {USER_ACCESS_STATUS_LABELS.REJECTED}
            </SelectItem>
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
            {filteredAccounts.length} de {accountsForCurrentStatus.length}
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
              {accountsForCurrentStatus.length
                ? "No hay usuarios que coincidan con esos filtros."
                : accessFilter === "REJECTED"
                  ? "No hay solicitudes rechazadas para mostrar."
                  : "No hay usuarios aprobados o suspendidos para mostrar."}
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
                  Perfil de usuario y datos operativos de la cuenta.
                </DialogDescription>
              </DialogHeader>

              <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />

              <div className="rounded-lg border border-border/60 bg-background/25 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="admin-account-name">
                      Nombre de la cuenta
                    </Label>
                    <Input
                      id="admin-account-name"
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      maxLength={120}
                      disabled={nameSaving || isSelectedPending}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleNameSave()}
                    disabled={nameChangeDisabled || isSelectedPending}
                  >
                    <Save className="h-4 w-4" />
                    {nameSaving ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>

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
                  {selectedAccount.accessReviewedAt ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Revisada el{" "}
                      {formatDisplayDate(
                        selectedAccount.accessReviewedAt,
                        "d MMM yyyy"
                      )}
                      {selectedAccount.accessReviewedBy
                        ? ` por ${selectedAccount.accessReviewedBy.name}`
                        : ""}
                    </p>
                  ) : null}
                  {selectedAccount.accessReviewNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nota de revisión: {selectedAccount.accessReviewNote}
                    </p>
                  ) : null}
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
                        Acceso de cuenta
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Suspende acceso, reactiva cuentas suspendidas o libera
                        datos personales cuando sea necesario.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAccount.accessStatus === "APPROVED" ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAccessDialogAction("SUSPEND")}
                          disabled={!canSuspendAccount || isSelectedPending}
                        >
                          <UserX className="h-4 w-4" />
                          Suspender
                        </Button>
                      ) : null}
                      {selectedAccount.accessStatus === "SUSPENDED" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setAccessDialogAction("REACTIVATE")}
                          disabled={!canReactivateAccount || isSelectedPending}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Reactivar
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => {
                          setAnonymizeAccount(selectedAccount);
                          setAnonymizeConfirmationEmail("");
                        }}
                        disabled={!canAnonymizeAccount || isSelectedPending}
                      >
                        <Eraser className="h-4 w-4" />
                        Liberar correo
                      </Button>
                    </div>
                  </div>
                  {selectedAccount.accessStatus === "SUSPENDED" ? (
                    <p className="mt-2 text-sm text-warning">
                      Esta cuenta no puede iniciar sesión hasta que se reactive.
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

      <Dialog
        open={!!accessDialogAction && !!selectedAccount}
        onOpenChange={(open) => {
          if (!open) {
            setAccessDialogAction(null);
            setAccessNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accessDialogAction === "SUSPEND"
                ? "Suspender cuenta"
                : "Reactivar cuenta"}
            </DialogTitle>
            <DialogDescription>
              {accessDialogAction === "SUSPEND"
                ? "La cuenta no podrá iniciar sesión y, si es voluntario, sus asignaciones futuras requerirán reemplazo."
                : "La cuenta volverá a tener acceso aprobado."}
            </DialogDescription>
          </DialogHeader>

          {accessDialogAction === "REACTIVATE" &&
          selectedAccount?.role === "VOLUNTEER" ? (
            <div className="space-y-3 rounded-lg border border-border/60 bg-background/25 p-3">
              <p className="text-sm font-medium">Capacidades operativas</p>
              <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5">
                <Checkbox
                  checked={reactivationDraft.canServeAsPrimary}
                  onCheckedChange={(checked) =>
                    setReactivationDraft((current) => ({
                      ...current,
                      canServeAsPrimary: checked === true
                    }))
                  }
                />
                <span className="text-sm">Puede servir como titular</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5">
                <Checkbox
                  checked={reactivationDraft.canServeAsReplacement}
                  onCheckedChange={(checked) =>
                    setReactivationDraft((current) => ({
                      ...current,
                      canServeAsReplacement: checked === true
                    }))
                  }
                />
                <span className="text-sm">Puede servir como suplente</span>
              </label>
              {!reactivationDraftHasCapacity ? (
                <p className="text-sm text-danger">
                  Selecciona al menos una capacidad.
                </p>
              ) : null}
            </div>
          ) : null}

          <Textarea
            value={accessNote}
            onChange={(event) => setAccessNote(event.target.value)}
            placeholder="Nota opcional para auditoría interna"
            maxLength={500}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAccessDialogAction(null);
                setAccessNote("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={accessDialogAction === "SUSPEND" ? "danger" : "default"}
              disabled={
                !selectedAccount ||
                pendingUserId === selectedAccount.id ||
                (accessDialogAction === "REACTIVATE" &&
                  selectedAccount.role === "VOLUNTEER" &&
                  !reactivationDraftHasCapacity)
              }
              onClick={() => void handleAccessChange()}
            >
              {accessDialogAction === "SUSPEND" ? "Suspender" : "Reactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!anonymizeAccount}
        onOpenChange={(open) => {
          if (!open) {
            setAnonymizeAccount(null);
            setAnonymizeConfirmationEmail("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar correo y anonimizar</DialogTitle>
            <DialogDescription>
              Esta acción reemplaza nombre, email y teléfono por datos locales
              no personales. El correo original quedará disponible para un nuevo
              registro.
            </DialogDescription>
          </DialogHeader>

          {anonymizeAccount ? (
            <div className="space-y-3">
              <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                Escribe el correo actual para confirmar:{" "}
                <span className="font-medium text-foreground">
                  {anonymizeAccount.email}
                </span>
              </p>
              <Input
                value={anonymizeConfirmationEmail}
                onChange={(event) =>
                  setAnonymizeConfirmationEmail(event.target.value)
                }
                placeholder={anonymizeAccount.email}
                autoComplete="off"
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAnonymizeAccount(null);
                setAnonymizeConfirmationEmail("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={
                !anonymizeAccount ||
                pendingUserId === anonymizeAccount.id ||
                anonymizeConfirmationEmail.trim().toLowerCase() !==
                  anonymizeAccount.email.toLowerCase()
              }
              onClick={() => void handleAnonymize()}
            >
              Liberar correo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
