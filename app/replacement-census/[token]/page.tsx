import { addDays } from "date-fns";
import { AlertCircle, CheckCircle2, Clock3, MailX } from "lucide-react";

import { ReplacementCensusForm } from "@/components/replacement-census/replacement-census-form";
import { Card, CardContent } from "@/components/ui/card";
import { DAYS_OF_WEEK } from "@/lib/constants/domain";
import { formatDateRange, formatDisplayDate } from "@/lib/utils";
import {
  getReplacementCensusResponseContext,
  type ReplacementCensusResponseContext
} from "@/services/replacement-census.service";

export const dynamic = "force-dynamic";

type ReplacementCensusPageProps = {
  params: Promise<{ token: string }>;
};

function buildWeekDays(weekStart: Date) {
  return DAYS_OF_WEEK.map((dayOfWeek, index) => ({
    date: addDays(weekStart, index).toISOString().slice(0, 10),
    dayOfWeek
  }));
}

function UnavailableCensusCard({
  context
}: {
  context: ReplacementCensusResponseContext;
}) {
  if (context.state === "READY") {
    return null;
  }

  const copy = {
    NOT_FOUND: {
      icon: AlertCircle,
      title: "Censo no encontrado",
      body: "El enlace no es válido o ya no está disponible."
    },
    EXPIRED: {
      icon: Clock3,
      title: "Censo expirado",
      body: "El tiempo para responder este censo terminó."
    },
    RESPONDED: {
      icon: CheckCircle2,
      title: "Disponibilidad registrada",
      body: "Tu respuesta para este censo semanal ya fue guardada."
    },
    FAILED: {
      icon: MailX,
      title: "Censo no disponible",
      body: "Solicita al administrador que revise este censo."
    }
  }[context.state];
  const Icon = copy.icon;
  const hasContext = context.state !== "NOT_FOUND";

  return (
    <Card className="surface-elevated mx-auto max-w-xl">
      <CardContent className="space-y-6 p-8 text-center">
        <div className="bg-white/8 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
            Censo semanal de suplentes
          </p>
          <h1 className="font-heading text-3xl font-semibold">{copy.title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{copy.body}</p>
        </div>
        {hasContext ? (
          <div className="rounded-3xl bg-background/60 p-5 text-sm text-muted-foreground">
            <p>{formatDateRange(context.weekStart, context.weekEnd)}</p>
            <p>
              Cierre:{" "}
              {formatDisplayDate(
                context.closesAt,
                "d 'de' MMMM 'de' yyyy, HH:mm"
              )}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function ReplacementCensusPage({
  params
}: ReplacementCensusPageProps) {
  const { token } = await params;
  const context = await getReplacementCensusResponseContext(token);

  return (
    <main className="min-h-screen px-4 py-10">
      {context.state === "READY" ? (
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
              Censo semanal de suplentes
            </p>
            <h1 className="font-heading text-4xl font-semibold">
              Hola {context.volunteerName}, indica tu disponibilidad
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDateRange(context.weekStart, context.weekEnd)}.
            </p>
          </div>
          <ReplacementCensusForm
            submitUrl={`/api/replacement-census/${encodeURIComponent(
              context.token
            )}`}
            weekDays={buildWeekDays(context.weekStart)}
            initialAvailability={context.availability.map((item) => ({
              date: item.date.toISOString().slice(0, 10),
              dayOfWeek: item.dayOfWeek,
              timeSlot: item.timeSlot,
              available: item.available,
              notes: item.notes
            }))}
          />
        </div>
      ) : (
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
          <UnavailableCensusCard context={context} />
        </div>
      )}
    </main>
  );
}
