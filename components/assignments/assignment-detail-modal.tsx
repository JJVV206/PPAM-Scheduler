"use client";

import { MapPin, NotebookPen, TimerReset, Users2 } from "lucide-react";

import { StatusBadge } from "@/components/assignments/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TIME_SLOT_DEFINITIONS } from "@/lib/constants/domain";
import { formatDisplayDate } from "@/lib/utils";
import type { AssignmentDetailDto } from "@/types/domain";

type AssignmentDetailModalProps = {
  assignment: AssignmentDetailDto;
  triggerLabel?: string;
};

export function AssignmentDetailModal({
  assignment,
  triggerLabel = "View details"
}: AssignmentDetailModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{assignment.preachingPoint.name}</DialogTitle>
          <DialogDescription>
            Couple {assignment.pairNumber} •{" "}
            {formatDisplayDate(assignment.date, "EEEE, MMM d")} •{" "}
            {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-5 p-6">
              <div className="space-y-3">
                <StatusBadge status={assignment.status} />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {assignment.preachingPoint.area}
                  </p>
                  <p className="flex items-center gap-2">
                    <TimerReset className="h-4 w-4" />
                    {TIME_SLOT_DEFINITIONS[assignment.timeSlot].label}
                  </p>
                  <p className="flex items-center gap-2">
                    <NotebookPen className="h-4 w-4" />
                    {assignment.notes ?? "No notes added"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Users2 className="h-4 w-4" />
                  Assigned Volunteers
                </p>
                <div className="space-y-3">
                  {assignment.volunteers.map((volunteer) => (
                    <div
                      key={volunteer.assignmentVolunteerId}
                      className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{volunteer.volunteer.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {volunteer.position}
                            {volunteer.isReplacement ? " • Replacement" : ""}
                          </p>
                        </div>
                        <StatusBadge status={volunteer.responseStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03]">
            <CardContent className="space-y-4 p-6">
              <p className="font-semibold">Activity Timeline</p>
              <div className="space-y-3">
                {assignment.timeline.length ? (
                  assignment.timeline.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-white/5 bg-background/40 p-4"
                    >
                      <p className="text-sm font-medium">{entry.actionType.replaceAll("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDisplayDate(entry.createdAt, "MMM d, h:mm a")}
                        {entry.actorName ? ` • ${entry.actorName}` : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
