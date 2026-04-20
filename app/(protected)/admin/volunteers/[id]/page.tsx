import { notFound } from "next/navigation";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import { VolunteerProfileCard } from "@/components/volunteers/volunteer-profile-card";
import { getVolunteer } from "@/services/volunteer.service";
import { getVolunteerHistory } from "@/services/assignment.service";

type AdminVolunteerProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminVolunteerProfilePage({
  params
}: AdminVolunteerProfilePageProps) {
  try {
    const { id } = await params;
    const [volunteer, history] = await Promise.all([
      getVolunteer(id),
      getVolunteerHistory(id)
    ]);

    return (
      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.4fr]">
        <VolunteerProfileCard volunteer={volunteer} />
        <div className="space-y-4">
          <h1 className="font-heading text-3xl font-semibold">Assignment History</h1>
          {history.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
