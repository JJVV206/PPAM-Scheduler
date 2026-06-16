import { AlertCircle, CheckCircle2, Clock3, MailX } from "lucide-react";

import { ConfirmationCard } from "@/components/assignments/confirmation-card";
import { Card, CardContent } from "@/components/ui/card";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import {
  getAssignmentInvitationConfirmationContext,
  type AssignmentInvitationConfirmationContext
} from "@/services/assignment.service";

export const dynamic = "force-dynamic";

type ConfirmAssignmentPageProps = {
  params: Promise<{ token: string }>;
};

function InvitationUnavailableCard({
  context
}: {
  context: Exclude<AssignmentInvitationConfirmationContext, { state: "READY" }>;
}) {
  const copy = {
    NOT_FOUND: {
      icon: AlertCircle,
      title: "Invitación no encontrada",
      body: "El enlace no es válido o ya no está disponible."
    },
    EXPIRED: {
      icon: Clock3,
      title: "Invitación expirada",
      body: "El tiempo para responder esta invitación terminó."
    },
    RESPONDED: {
      icon: CheckCircle2,
      title: "Respuesta registrada",
      body: "Esta invitación ya fue respondida."
    },
    FAILED: {
      icon: MailX,
      title: "Invitación no disponible",
      body: "Solicita al administrador que envíe una nueva invitación."
    }
  }[context.state];
  const Icon = copy.icon;
  const hasAssignmentContext = context.state !== "NOT_FOUND";

  return (
    <Card className="surface-elevated mx-auto max-w-xl">
      <CardContent className="space-y-6 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/8">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
            Confirmación de asignación
          </p>
          <h1 className="font-heading text-3xl font-semibold">{copy.title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{copy.body}</p>
        </div>
        {hasAssignmentContext ? (
          <div className="rounded-3xl bg-background/60 p-5 text-sm text-muted-foreground">
            <p>{formatDisplayDate(context.date, "EEEE d 'de' MMMM")}</p>
            <p>{TIME_SLOT_DEFINITIONS[context.timeSlot].label}</p>
            <p>{context.pointName}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function ConfirmAssignmentPage({
  params
}: ConfirmAssignmentPageProps) {
  const { token } = await params;
  const context = await getAssignmentInvitationConfirmationContext(token);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      {context.state === "READY" ? (
        <ConfirmationCard
          invitationToken={context.token}
          pointName={context.pointName}
          date={context.date}
          timeSlot={context.timeSlot}
        />
      ) : (
        <InvitationUnavailableCard context={context} />
      )}
    </main>
  );
}
