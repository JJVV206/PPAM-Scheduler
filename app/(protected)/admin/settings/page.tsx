import { SettingsForm } from "@/features/settings/settings-form";
import { getAppSettings } from "@/services/setting.service";

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Configura la anticipación de confirmación, la cadencia de recordatorios y los canales de entrega.
        </p>
      </div>
      <SettingsForm initialValues={settings} />
    </div>
  );
}
