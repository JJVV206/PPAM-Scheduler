import Link from "next/link";

import { AssignmentCard } from "@/components/assignments/assignment-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/forms/empty-state";
import { getServerAuthSession } from "@/lib/auth/auth";
import { getVolunteerHistory } from "@/services/assignment.service";

export default async function VolunteerAssignmentsPage() {
  const session = await getServerAuthSession();

  if (!session?.user.volunteerProfileId) {
    return null;
  }

  const assignments = await getVolunteerHistory(session.user.volunteerProfileId);

  return assignments.length ? (
    <div className="grid gap-4 lg:grid-cols-2">
      {assignments.map((assignment) => (
        <div key={assignment.id} className="space-y-3">
          <AssignmentCard assignment={assignment} />
          <Button variant="secondary" asChild>
            <Link href={`/volunteer/assignments/${assignment.id}`}>Open details</Link>
          </Button>
        </div>
      ))}
    </div>
  ) : (
    <EmptyState
      title="No assignments yet"
      description="Your confirmed and upcoming assignments will appear here."
    />
  );
}
