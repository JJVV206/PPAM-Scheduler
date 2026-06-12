import { revalidatePath } from "next/cache";

const VOLUNTEER_DEPENDENT_PATHS = [
  "/admin",
  "/admin/assignments",
  "/admin/open-slots",
  "/admin/reports",
  "/admin/schedule",
  "/admin/volunteers"
];

export function revalidateVolunteerViews(volunteerId?: string) {
  VOLUNTEER_DEPENDENT_PATHS.forEach((path) => revalidatePath(path));

  if (volunteerId) {
    revalidatePath(`/admin/volunteers/${volunteerId}`);
  }
}
