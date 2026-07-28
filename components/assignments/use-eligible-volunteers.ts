"use client";

import { useQuery } from "@tanstack/react-query";

import type {
  EligibleVolunteersResponse,
  TimeSlot
} from "@/types/domain";

type UseEligibleVolunteersInput = {
  assignmentId?: string;
  date: string;
  enabled?: boolean;
  timeSlot: TimeSlot;
};

async function fetchEligibleVolunteers(input: {
  assignmentId?: string;
  date: string;
  timeSlot: TimeSlot;
}) {
  const params = new URLSearchParams({
    date: input.date,
    timeSlot: input.timeSlot
  });
  if (input.assignmentId) {
    params.set("assignmentId", input.assignmentId);
  }

  const response = await fetch(
    "/api/admin/volunteers/eligible?" + params.toString()
  );
  const result = (await response.json()) as EligibleVolunteersResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      result.error ?? "No fue posible consultar los voluntarios disponibles."
    );
  }

  return result;
}

export function useEligibleVolunteers({
  assignmentId,
  date,
  enabled = true,
  timeSlot
}: UseEligibleVolunteersInput) {
  return useQuery({
    queryKey: ["admin", "eligible-volunteers", date, timeSlot, assignmentId],
    queryFn: () =>
      fetchEligibleVolunteers({
        assignmentId,
        date,
        timeSlot
      }),
    enabled: enabled && Boolean(date && timeSlot),
    staleTime: 30_000,
    retry: 1
  });
}
