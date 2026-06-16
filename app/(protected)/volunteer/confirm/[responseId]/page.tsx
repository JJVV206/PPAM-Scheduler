import { notFound } from "next/navigation";

import { ConfirmationCard } from "@/components/assignments/confirmation-card";
import { getServerAuthSession } from "@/lib/auth/auth";
import { FIXED_PREACHING_POINT_NAME } from "@/lib/constants/preaching-point";
import { db } from "@/lib/db/prisma";

type VolunteerConfirmPageProps = {
  params: Promise<{ responseId: string }>;
};

export default async function VolunteerConfirmPage({
  params
}: VolunteerConfirmPageProps) {
  const { responseId } = await params;
  const session = await getServerAuthSession();

  const response = await db.assignmentResponse.findUnique({
    where: { id: responseId },
    include: {
      assignment: {
        include: {
          preachingPoint: true
        }
      }
    }
  });

  if (
    !response ||
    !session?.user.volunteerProfileId ||
    response.volunteerId !== session.user.volunteerProfileId
  ) {
    notFound();
  }

  return (
    <ConfirmationCard
      responseId={response.id}
      pointName={FIXED_PREACHING_POINT_NAME}
      date={response.assignment.date}
      timeSlot={response.assignment.timeSlot}
    />
  );
}
