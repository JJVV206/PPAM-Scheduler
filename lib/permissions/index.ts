import type { UserRole } from "@/types/domain";

export const rolePermissions: Record<UserRole, string[]> = {
  ADMIN: [
    "dashboard:view",
    "schedule:manage",
    "assignments:manage",
    "volunteers:manage",
    "points:manage",
    "openSlots:manage",
    "notifications:view",
    "reports:view",
    "settings:manage"
  ],
  VOLUNTEER: [
    "dashboard:view",
    "assignments:viewOwn",
    "assignments:respond",
    "openSlots:view",
    "openSlots:accept",
    "availability:manageOwn",
    "profile:manageOwn"
  ]
};

export function hasPermission(role: UserRole, permission: string) {
  return rolePermissions[role].includes(permission);
}
