import { VolunteerSelfProfileCard } from "@/components/volunteer/volunteer-self-profile-card";
import { AccountNameForm } from "@/features/account/account-name-form";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteer } from "@/services/volunteer.service";

export default async function VolunteerProfilePage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const volunteer = await getVolunteer(session.user.volunteerProfileId);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Revisa tu contacto, preferencias y disponibilidad general.
        </p>
      </div>
      <AccountNameForm initialName={session.user.name ?? volunteer.name} />
      <VolunteerSelfProfileCard volunteer={volunteer} />
    </div>
  );
}
