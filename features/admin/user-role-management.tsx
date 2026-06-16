"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Badge } from "@/components/ui/badge";
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
import { ROLE_LABELS } from "@/lib/constants/domain";
import type { UserAccountDto } from "@/services/user.service";
import type { UserRole } from "@/types/domain";

type UserRoleManagementProps = {
  accounts: UserAccountDto[];
};

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

function getRoleBadgeVariant(role: UserRole) {
  return role === "ADMIN" ? "default" : "success";
}

export function UserRoleManagement({ accounts }: UserRoleManagementProps) {
  const router = useRouter();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const activeAdminCount = useMemo(
    () =>
      accounts.filter(
        (account) => account.role === "ADMIN" && account.active
      ).length,
    [accounts]
  );

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
    const result = await response.json();

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result.error ?? "No se pudo actualizar el rol de la cuenta."
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

  return (
    <div className="space-y-4">
      <FeedbackMessage
        message={feedback?.text}
        tone={feedback?.tone}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuenta</TableHead>
            <TableHead>Rol actual</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Delegar como</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length ? (
            accounts.map((account) => {
              const isOnlyActiveAdmin =
                account.role === "ADMIN" &&
                account.active &&
                activeAdminCount === 1;
              const isPending = pendingUserId === account.id;

              return (
                <TableRow key={account.id}>
                  <TableCell className="min-w-[240px]">
                    <p className="font-medium">{account.name}</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {account.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {account.active ? "Cuenta activa" : "Cuenta inactiva"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(account.role)}>
                      {ROLE_LABELS[account.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[190px]">
                    <p className="text-sm">{getProfileStatus(account)}</p>
                    {isOnlyActiveAdmin ? (
                      <p className="mt-1 text-xs text-warning">
                        Último administrador activo
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-[210px]">
                    <Select
                      value={account.role}
                      onValueChange={(role) =>
                        void handleRoleChange(account, role)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-full md:w-48">
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
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-32 text-center text-muted-foreground"
              >
                No hay cuentas registradas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
