import { revalidatePath } from "next/cache";

type RevalidateAssignmentViewsInput = {
  assignmentId?: string;
  date?: Date | string;
  timeSlot?: string;
};

const ASSIGNMENT_LIST_PATHS = [
  "/admin",
  "/admin/assignments",
  "/admin/open-slots",
  "/admin/reports",
  "/admin/schedule",
  "/volunteer",
  "/volunteer/assignments",
  "/volunteer/open-slots"
];

function toDateSegment(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

export function revalidateAssignmentViews(input: RevalidateAssignmentViewsInput = {}) {
  ASSIGNMENT_LIST_PATHS.forEach((path) => revalidatePath(path));

  if (input.assignmentId) {
    revalidatePath(`/admin/assignments/${input.assignmentId}`);
    revalidatePath(`/volunteer/assignments/${input.assignmentId}`);
  }

  if (input.date && input.timeSlot) {
    revalidatePath(
      `/admin/schedule/${toDateSegment(input.date)}/${input.timeSlot}`
    );
  }
}
