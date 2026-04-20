"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAssignmentSchema } from "@/lib/validations/assignment";
import { DAYS_OF_WEEK, TIME_SLOTS } from "@/lib/constants/domain";
import type { PreachingPointSummary, VolunteerSummary } from "@/types/domain";

const assignmentFormSchema = createAssignmentSchema.extend({
  volunteerOneId: z.string().optional(),
  volunteerTwoId: z.string().optional()
});

type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

type AssignmentFormProps = {
  scheduleWeekId: string;
  preachingPoints: PreachingPointSummary[];
  volunteers: VolunteerSummary[];
};

export function AssignmentForm({
  scheduleWeekId,
  preachingPoints,
  volunteers
}: AssignmentFormProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const defaultValues = useMemo<AssignmentFormValues>(
    () => ({
      scheduleWeekId,
      date: new Date().toISOString(),
      dayOfWeek: "MONDAY",
      timeSlot: "SLOT_09_11",
      preachingPointId: preachingPoints[0]?.id ?? "",
      notes: "",
      volunteers: [],
      volunteerOneId: "",
      volunteerTwoId: ""
    }),
    [preachingPoints, scheduleWeekId]
  );

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues
  });

  async function onSubmit(values: AssignmentFormValues) {
    setSubmitting(true);
    setMessage(null);

    const payload = {
      scheduleWeekId: values.scheduleWeekId,
      date: new Date(values.date).toISOString(),
      dayOfWeek: values.dayOfWeek,
      timeSlot: values.timeSlot,
      preachingPointId: values.preachingPointId,
      notes: values.notes,
      volunteers: [
        values.volunteerOneId
          ? { volunteerId: values.volunteerOneId, position: "FIRST" as const }
          : null,
        values.volunteerTwoId
          ? { volunteerId: values.volunteerTwoId, position: "SECOND" as const }
          : null
      ].filter(Boolean)
    };

    const response = await fetch("/api/assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const result = await response.json();
      setMessage(result.error ?? "Unable to create assignment.");
      setSubmitting(false);
      return;
    }

    setMessage("Assignment created. Refresh to see the latest schedule.");
    form.reset(defaultValues);
    setSubmitting(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">New Assignment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Weekly Assignment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={field.value.slice(0, 16)}
                      onChange={(event) =>
                        field.onChange(new Date(event.target.value).toISOString())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timeSlot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Slot</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIME_SLOTS.map((timeSlot) => (
                          <SelectItem key={timeSlot} value={timeSlot}>
                            {timeSlot.replace("SLOT_", "").replaceAll("_", ":")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="preachingPointId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preaching Point</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a point" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {preachingPoints.map((point) => (
                        <SelectItem key={point.id} value={point.id}>
                          {point.name} • {point.area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="volunteerOneId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volunteer 1</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign first volunteer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {volunteers.map((volunteer) => (
                          <SelectItem key={volunteer.id} value={volunteer.id}>
                            {volunteer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volunteerTwoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volunteer 2</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign second volunteer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {volunteers.map((volunteer) => (
                          <SelectItem key={volunteer.id} value={volunteer.id}>
                            {volunteer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving..." : "Create Assignment"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
