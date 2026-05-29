import { VolunteerProfileCard } from "@/components/volunteers/volunteer-profile-card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteer } from "@/services/volunteer.service";

export default async function VolunteerProfilePage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const volunteer = await getVolunteer(session.user.volunteerProfileId);

  return (
    <div className="max-w-3xl">
      <VolunteerProfileCard volunteer={volunteer} />
    </div>
  );
}
