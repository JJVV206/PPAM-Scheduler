import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountNameForm } from "@/features/account/account-name-form";
import { getServerAuthSession } from "@/lib/auth/auth";

export default async function AdminAccountPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/logout?next=/login");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold">Cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Administra el nombre visible de tu cuenta.
        </p>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle>Datos de cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountNameForm initialName={session.user.name ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
