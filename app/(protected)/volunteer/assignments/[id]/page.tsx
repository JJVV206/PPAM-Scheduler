import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ConfirmationCard } from "@/components/assignments/confirmation-card";
import { Button } from "@/components/ui/button";
import { VolunteerAssignmentCard } from "@/components/volunteer/volunteer-assignment-card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getAssignmentDetail } from "@/services/assignment.service";
import { getVolunteerAssignmentRemindersById } from "@/services/volunteer.service";

type VolunteerAssignmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function VolunteerAssignmentDetailPage({
  params
}: VolunteerAssignmentDetailPageProps) {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    redirect("/login");
  }

  try {
    const { id } = await params;
    const assignment = await getAssignmentDetail(id);
    const currentVolunteer = assignment.volunteers.find(
      (volunteer) => volunteer.volunteerId === session.user.volunteerProfileId
    );
    const isParticipant = Boolean(currentVolunteer);

    if (!isParticipant) {
      redirect("/volunteer/assignments");
    }
    const remindersByAssignmentId = await getVolunteerAssignmentRemindersById({
      userId: session.user.id,
      assignmentIds: [assignment.id]
    });

    return (
      <div className="space-y-6">
        <section className="surface-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-semibold">
              Detalle del turno
            </h1>
            <p className="text-sm text-muted-foreground">
              Revisa los datos antes de confirmar o avisar que no puedes
              asistir.
            </p>
          </div>
          <Button variant="secondary" className="w-full sm:w-auto" asChild>
            <Link href="/volunteer/assignments">
              <ArrowLeft className="h-4 w-4" />
              Mis asignaciones
            </Link>
          </Button>
        </section>

        <VolunteerAssignmentCard
          assignment={assignment}
          volunteerProfileId={session.user.volunteerProfileId}
          reminders={remindersByAssignmentId[assignment.id]}
          showDetailLink={false}
        />
        {currentVolunteer?.responseId ? (
          <ConfirmationCard
            responseId={currentVolunteer.responseId}
            pointName={assignment.preachingPoint.name}
            date={assignment.date}
            timeSlot={assignment.timeSlot}
          />
        ) : null}
      </div>
    );
  } catch {
    notFound();
  }
}
