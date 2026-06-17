import { SettingsForm } from "@/features/settings/settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NOTIFICATION_CHANNEL_LABELS } from "@/lib/constants/domain";
import { getEmailDeliveryConfig } from "@/lib/env/config";
import { formatDisplayDate } from "@/lib/utils";
import {
  getAppSettings,
  getAssignmentAutomationLastRunSummary,
  getAssignmentAutomationSettings
} from "@/services/setting.service";

function getSafeEmailSummary() {
  try {
    const email = getEmailDeliveryConfig();

    if (!email) {
      return {
        status: "No configurado",
        provider: "Simulado",
        from: "Sin remitente",
        host: "Sin servidor",
        auth: "No"
      };
    }

    if (email.provider === "resend") {
      return {
        status: "Configurado",
        provider: "Resend API",
        from: email.from,
        host: "api.resend.com",
        auth: "API key"
      };
    }

    return {
      status: "Configurado",
      provider: "SMTP",
      from: email.from,
      host: `${email.host}:${email.port}`,
      auth: email.auth ? "Sí" : "No"
    };
  } catch {
    return {
      status: "Requiere revisión",
      provider: "No disponible",
      from: "No disponible",
      host: "No disponible",
      auth: "No disponible"
    };
  }
}

function ConfigRow({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const [settings, automationSettings, lastRun] = await Promise.all([
    getAppSettings(),
    getAssignmentAutomationSettings(),
    getAssignmentAutomationLastRunSummary()
  ]);
  const email = getSafeEmailSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Configura la anticipación de confirmación, la cadencia de recordatorios y los canales de entrega.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <SettingsForm initialValues={settings} />

        <div className="space-y-6">
          <Card className="surface-elevated">
            <CardHeader>
              <CardTitle>Estado del cron</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    lastRun?.status === "completed"
                      ? "success"
                      : lastRun
                        ? "warning"
                        : "outline"
                  }
                >
                  {lastRun
                    ? lastRun.status === "completed"
                      ? "Activo"
                      : "Con alertas"
                    : "Sin ejecuciones"}
                </Badge>
                {lastRun ? (
                  <span className="text-sm text-muted-foreground">
                    Última ejecución{" "}
                    {formatDisplayDate(lastRun.finishedAt, "d MMM, HH:mm")}
                  </span>
                ) : null}
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/25 px-4">
                <ConfigRow
                  label="Duración"
                  value={lastRun ? `${lastRun.durationMs} ms` : "Pendiente"}
                />
                <ConfigRow
                  label="Pasos con alerta"
                  value={lastRun ? lastRun.failedStepCount : "Pendiente"}
                />
                <ConfigRow
                  label="Resumen guardado"
                  value={lastRun?.summarySaved ? "Sí" : lastRun ? "No" : "Pendiente"}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="surface-elevated">
            <CardHeader>
              <CardTitle>Remitente y templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/25 px-4">
                <ConfigRow label="Email" value={email.status} />
                <ConfigRow label="Proveedor" value={email.provider} />
                <ConfigRow label="Servidor" value={email.host} />
                <ConfigRow label="Remitente" value={email.from} />
                <ConfigRow label="Autenticación" value={email.auth} />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "Solicitud titular",
                  "Recordatorio titular",
                  "Censo suplentes",
                  "Recordatorio censo",
                  "Oportunidad suplente",
                  "Alerta admin"
                ].map((template) => (
                  <Badge key={template} variant="secondary">
                    {template}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="surface-elevated">
        <CardHeader>
          <CardTitle>Automatización</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/25 px-4">
              <ConfigRow
                label="Tiempo respuesta titular"
                value={`${automationSettings.primaryResponseTimeoutHours} horas`}
              />
              <ConfigRow
                label="Recordatorios titular"
                value={`${automationSettings.primaryReminderOffsetsHours.join(", ")} horas`}
              />
              <ConfigRow
                label="Tiempo respuesta suplente"
                value={`${automationSettings.replacementResponseTimeoutHours} horas`}
              />
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/25 px-4">
              <ConfigRow
                label="Recordatorios suplente"
                value={`${automationSettings.replacementReminderOffsetsHours.join(", ")} horas`}
              />
              <ConfigRow
                label="Recordatorios del turno"
                value={`${automationSettings.reminderTimingDays.join(", ")} días`}
              />
              <ConfigRow
                label="Recordatorio final"
                value={`${automationSettings.finalReminderHours} horas antes`}
              />
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/25 px-4">
              <ConfigRow
                label="Tiempo respuesta censo"
                value={`${automationSettings.censusResponseTimeoutHours} horas`}
              />
              <ConfigRow
                label="Recordatorios censo"
                value={`${automationSettings.censusReminderOffsetsHours.join(", ")} horas`}
              />
              <ConfigRow
                label="Canales activos"
                value={automationSettings.notificationChannels
                  .map((channel) => NOTIFICATION_CHANNEL_LABELS[channel])
                  .join(", ")}
              />
              <ConfigRow
                label="Email admin"
                value={automationSettings.adminAlertEmail}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
