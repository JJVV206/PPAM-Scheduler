import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteer } from "@/services/volunteer.service";
import { AvailabilitySelector } from "@/components/availability/availability-selector";

export default async function VolunteerAvailabilityPage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const volunteer = await getVolunteer(session.user.volunteerProfileId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold">My Availability</h1>
        <p className="text-sm text-muted-foreground">
          Define recurring weekly time slots you are available to serve.
        </p>
      </div>
      <AvailabilitySelector
        volunteerId={volunteer.id}
        initialAvailability={volunteer.availability.map((item) => ({
          dayOfWeek: item.dayOfWeek,
          timeSlot: item.timeSlot
        }))}
        initialTemporaryUnavailable={volunteer.temporaryUnavailable}
      />
    </div>
  );
}
