"use client";

import { AssignmentDetailContent } from "@/components/assignments/assignment-detail-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import type {
  AssignmentDetailDto,
  PreachingPointSummary
} from "@/types/domain";

type AssignmentDetailModalProps = {
  assignment: AssignmentDetailDto;
  triggerLabel?: string;
  preachingPoints?: PreachingPointSummary[];
};

export function AssignmentDetailModal({
  assignment,
  triggerLabel = "Ver detalles",
  preachingPoints
}: AssignmentDetailModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-5 sm:p-6">
        <DialogHeader className="pr-10">
          <DialogTitle>{assignment.preachingPoint.name}</DialogTitle>
          <DialogDescription>
            Pareja {assignment.pairNumber} •{" "}
            {formatDisplayDate(assignment.date, "EEEE d 'de' MMM")} •{" "}
            {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
          </DialogDescription>
        </DialogHeader>

        <AssignmentDetailContent
          assignment={assignment}
          preachingPoints={preachingPoints}
          compact
        />
      </DialogContent>
    </Dialog>
  );
}
