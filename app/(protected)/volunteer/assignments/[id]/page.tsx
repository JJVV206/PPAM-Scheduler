import { notFound, redirect } from "next/navigation";

import { AssignmentCard } from "@/components/assignments/assignment-card";
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
    const isParticipant = assignment.volunteers.some(
      (volunteer) => volunteer.volunteerId === session.user.volunteerProfileId
    );

    if (!isParticipant) {
      redirect("/volunteer/assignments");
    }

    return <AssignmentCard assignment={assignment} />;
  } catch {
    notFound();
  }
}
