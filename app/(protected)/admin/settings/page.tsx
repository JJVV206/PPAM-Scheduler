import { SettingsForm } from "@/features/settings/settings-form";
import { getAppSettings } from "@/services/setting.service";

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure confirmation lead time, reminder cadence, and delivery channels.
        </p>
      </div>
      <SettingsForm initialValues={settings} />
    </div>
  );
}
