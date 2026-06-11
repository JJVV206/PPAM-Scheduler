import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AssignmentDetailContent } from "@/components/assignments/assignment-detail-content";
import { StatusBadge } from "@/components/assignments/status-badge";
import { Button } from "@/components/ui/button";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import { getAssignmentDetail } from "@/services/assignment.service";
import { getPreachingPoints } from "@/services/point.service";
import { getVolunteers } from "@/services/volunteer.service";

type AdminAssignmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminAssignmentDetailPage({
  params
}: AdminAssignmentDetailPageProps) {
  try {
    const { id } = await params;
    const [assignment, preachingPoints, volunteers] = await Promise.all([
      getAssignmentDetail(id),
      getPreachingPoints(),
      getVolunteers()
    ]);

    return (
      <div className="flex min-h-full flex-col gap-5 pb-6">
        <div className="sticky top-0 z-20 bg-background/85 pb-2 pt-1 backdrop-blur">
          <div className="surface-panel rounded-[28px] px-5 py-4">
            <div className="space-y-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/schedule">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al horario
                </Link>
              </Button>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-heading text-3xl font-semibold">
                    {assignment.preachingPoint.name}
                  </h1>
                  <StatusBadge status={assignment.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Pareja {assignment.pairNumber} •{" "}
                  {formatDisplayDate(assignment.date, "EEEE d 'de' MMM")} •{" "}
                  {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
                </p>
              </div>
            </div>
          </div>
        </div>

        <AssignmentDetailContent
          assignment={assignment}
          preachingPoints={preachingPoints.map((point) => ({
            id: point.id,
            name: point.name,
            area: point.area,
            notes: point.notes,
            active: point.active,
            activeSlots: point.activeSlots.map((slot) => ({
              id: slot.id,
              dayOfWeek: slot.dayOfWeek,
              timeSlot: slot.timeSlot
            }))
          }))}
          volunteers={volunteers}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
