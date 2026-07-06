"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils";

type AttentionPriority = "URGENT" | "HIGH" | "NORMAL";

export type AdminAttentionCase = {
  id: string;
  priority: AttentionPriority;
  createdAt: Date;
  date: Date;
  timeLabel: string;
  pointName: string;
  problem: string;
  href: string;
  actionLabel: string;
  notificationId?: string;
  dismissible: boolean;
};

type AdminAttentionTableProps = {
  cases: AdminAttentionCase[];
};

const priorityLabels: Record<AttentionPriority, string> = {
  URGENT: "Urgente",
  HIGH: "Alta",
  NORMAL: "Normal"
};

function getPriorityVariant(priority: AttentionPriority) {
  if (priority === "URGENT") return "danger" as const;
  if (priority === "HIGH") return "warning" as const;
  return "secondary" as const;
}

export function AdminAttentionTable({ cases }: AdminAttentionTableProps) {
  const router = useRouter();
  const [visibleCases, setVisibleCases] = useState(cases);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  useEffect(() => {
    setVisibleCases(cases);
  }, [cases]);

  async function deleteCase(item: AdminAttentionCase) {
    if (!item.notificationId) return;

    setPendingId(item.id);
    setFeedback(null);

    const response = await fetch(
      `/api/app-notifications/${encodeURIComponent(item.notificationId)}`,
      {
        method: "DELETE"
      }
    );
    const result = (await response.json().catch(() => null)) as {
      deletedCount?: number;
      error?: string;
    } | null;

    if (!response.ok) {
      setFeedback({
        tone: "error",
        text: result?.error ?? "No se pudo borrar la alerta."
      });
      setPendingId(null);
      return;
    }

    setVisibleCases((currentCases) =>
      currentCases.filter((currentCase) => currentCase.id !== item.id)
    );
    setFeedback({
      tone: result?.deletedCount ? "success" : "warning",
      text: result?.deletedCount
        ? "Alerta borrada."
        : "La alerta ya no estaba activa."
    });
    setPendingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <FeedbackMessage message={feedback?.text} tone={feedback?.tone} />
      {!visibleCases.length ? (
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-border/70 bg-background/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No hay excepciones activas visibles.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridad</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Punto</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCases.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant={getPriorityVariant(item.priority)}>
                      {priorityLabels[item.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[150px] text-sm text-muted-foreground">
                    {formatDisplayDate(item.createdAt, "d 'de' MMMM, HH:mm")}
                  </TableCell>
                  <TableCell>
                    {formatDisplayDate(item.date, "d 'de' MMMM")}
                  </TableCell>
                  <TableCell>{item.timeLabel}</TableCell>
                  <TableCell>{item.pointName}</TableCell>
                  <TableCell className="max-w-xl text-sm text-muted-foreground">
                    {item.problem}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-[210px] flex-wrap justify-end gap-2">
                      <Button asChild size="sm">
                        <Link href={item.href}>{item.actionLabel}</Link>
                      </Button>
                      {item.dismissible ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void deleteCase(item)}
                          disabled={pendingId === item.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          {pendingId === item.id
                            ? "Borrando..."
                            : "Borrar alerta"}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
