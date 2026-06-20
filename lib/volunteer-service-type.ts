import type { VolunteerServiceType } from "@/types/domain";

export type VolunteerServiceCapabilities = {
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
};

export function hasVolunteerServiceCapacity(
  capabilities: VolunteerServiceCapabilities
) {
  return capabilities.canServeAsPrimary || capabilities.canServeAsReplacement;
}

export function deriveVolunteerServiceType(
  capabilities: VolunteerServiceCapabilities
): VolunteerServiceType {
  if (capabilities.canServeAsPrimary && capabilities.canServeAsReplacement) {
    return "PRIMARY_AND_REPLACEMENT";
  }

  if (capabilities.canServeAsReplacement) {
    return "REPLACEMENT";
  }

  return "PRIMARY";
}
