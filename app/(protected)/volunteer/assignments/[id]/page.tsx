import { notFound, redirect } from "next/navigation";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import { ConfirmationCard } from "@/components/assignments/confirmation-card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getAssignmentDetail } from "@/services/assignment.service";

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

    return (
      <div className="space-y-6">
        <AssignmentCard assignment={assignment} />
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
