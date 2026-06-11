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
        <h1 className="font-heading text-4xl font-semibold">
          Mi disponibilidad
        </h1>
        <p className="text-sm text-muted-foreground">
          Define los horarios recurrentes de la semana en los que estás
          disponible para servir.
        </p>
      </div>
      <AvailabilitySelector
        volunteerId={volunteer.id}
        initialAvailability={volunteer.availability.map((item) => ({
          dayOfWeek: item.dayOfWeek,
          timeSlot: item.timeSlot
        }))}
        initialTemporaryUnavailable={volunteer.temporaryUnavailable}
        initialExceptions={volunteer.availabilityBlocks.map((item) => ({
          id: item.id,
          startDate: item.startDate.toISOString().slice(0, 10),
          endDate: item.endDate.toISOString().slice(0, 10),
          reason: item.reason
        }))}
      />
    </div>
  );
}
