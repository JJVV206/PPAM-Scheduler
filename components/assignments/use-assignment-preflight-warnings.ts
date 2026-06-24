"use client";

import { useEffect, useMemo, useState } from "react";

import type { AssignmentPreflightWarningsDto, TimeSlot } from "@/types/domain";

type UseAssignmentPreflightWarningsInput = {
  assignmentId?: string;
  date: string;
  enabled?: boolean;
  timeSlot: TimeSlot;
  volunteerIds: string[];
};

const PREFLIGHT_DEBOUNCE_MS = 250;

function normalizeVolunteerIds(volunteerIds: string[]) {
  return [...new Set(volunteerIds.filter(Boolean))];
}

function buildWarningMessage(warnings: string[]) {
  return warnings.join(" ");
}

export function useAssignmentPreflightWarnings({
  assignmentId,
  date,
  enabled = true,
  timeSlot,
  volunteerIds
}: UseAssignmentPreflightWarningsInput) {
  const volunteerIdsKey = volunteerIds.filter(Boolean).join("|");
  const normalizedVolunteerIds = useMemo(
    () =>
      volunteerIdsKey ? normalizeVolunteerIds(volunteerIdsKey.split("|")) : [],
    [volunteerIdsKey]
  );
  const [data, setData] = useState<AssignmentPreflightWarningsDto>({
    warnings: [],
    repeatedVolunteerIds: [],
    repeatedVolunteers: []
  });

  useEffect(() => {
    if (!enabled || !date || !normalizedVolunteerIds.length) {
      setData({
        warnings: [],
        repeatedVolunteerIds: [],
        repeatedVolunteers: []
      });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/assignments/preflight", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            assignmentId,
            date,
            timeSlot,
            volunteerIds: normalizedVolunteerIds
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          setData({
            warnings: [],
            repeatedVolunteerIds: [],
            repeatedVolunteers: []
          });
          return;
        }

        const result =
          (await response.json()) as AssignmentPreflightWarningsDto;
        setData(result);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        setData({
          warnings: [],
          repeatedVolunteerIds: [],
          repeatedVolunteers: []
        });
      }
    }, PREFLIGHT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [assignmentId, date, enabled, normalizedVolunteerIds, timeSlot]);

  return {
    ...data,
    warningMessage: buildWarningMessage(data.warnings)
  };
}
