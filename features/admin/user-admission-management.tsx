"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { USER_ACCESS_STATUS_LABELS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import type { UserAccountDto } from "@/services/user.service";

type UserAdmissionManagementProps = {
  accounts: UserAccountDto[];
};

function getAccessBadgeVariant(accessStatus: UserAccountDto["accessStatus"]) {
  if (accessStatus === "PENDING_APPROVAL") return "warning";
  if (accessStatus === "REJECTED") return "danger";
  return "outline";
}

export function UserAdmissionManagement({
  accounts
}: UserAdmissionManagementProps) {
  const router = useRouter();
  const admissionAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        ["PENDING_APPROVAL", "REJECTED"].includes(account.accessStatus)
      ),
    [accounts]
  );
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [rejectingAccount, setRejectingAccount] =
    useState<UserAccountDto | null>(null);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  async function reviewAdmission(
    account: UserAccountDto,
    decision: "APPROVE" | "REJECT",
    reviewNote?: string
  ) {
    setPendingUserId(account.id);
    setFeedback(null);

    const response = await fetch(`/api/admin/users/${account.id}/admission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: reviewNote })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result.error ?? "No se pudo revisar la solicitud."
      });
      setPendingUserId(null);
      return;
    }

    setFeedback({
      tone: "success",
      text:
        decision === "APPROVE"
          ? `Cuenta aprobada para ${account.name}.`
          : `Solicitud rechazada para ${account.name}.`
    });
    setPendingUserId(null);
    setRejectingAccount(null);
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Solicitante</TableHead>
            <TableHead>Celular</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {admissionAccounts.length ? (
            admissionAccounts.map((account) => {
              const isPending = pendingUserId === account.id;

              return (
                <TableRow key={account.id}>
                  <TableCell className="min-w-[240px]">
                    <p className="font-medium">{account.name}</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {account.email}
                    </p>
                    {account.accessReviewNote ? (
                      <p className="mt-1 text-xs text-danger">
                        {account.accessReviewNote}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{account.phone}</TableCell>
                  <TableCell>
                    <Badge variant={getAccessBadgeVariant(account.accessStatus)}>
                      {USER_ACCESS_STATUS_LABELS[account.accessStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDisplayDate(account.createdAt, "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          void reviewAdmission(account, "APPROVE")
                        }
                        disabled={isPending}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectingAccount(account)}
                        disabled={isPending}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-32 text-center text-muted-foreground"
              >
                No hay solicitudes pendientes.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog
        open={!!rejectingAccount}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingAccount(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Nota opcional para referencia interna"
            maxLength={500}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectingAccount(null);
                setNote("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!rejectingAccount || pendingUserId === rejectingAccount.id}
              onClick={() => {
                if (!rejectingAccount) return;
                void reviewAdmission(rejectingAccount, "REJECT", note);
              }}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
