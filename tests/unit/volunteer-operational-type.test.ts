import { describe, expect, it } from "vitest";

import { deriveVolunteerServiceType } from "@/lib/volunteer-service-type";
import {
  createVolunteerSchema,
  updateVolunteerSchema
} from "@/lib/validations/volunteer";

describe("volunteer operational type", () => {
  it("defaults admin-created volunteers to primary only", () => {
    const result = createVolunteerSchema.parse({
      name: "Julia Rivera",
      email: "julia@example.org",
      phone: "5551234567",
      notes: "",
      transportationNotes: "",
      preferredAreas: [],
      active: true
    });

    expect(result.canServeAsPrimary).toBe(true);
    expect(result.canServeAsReplacement).toBe(false);
    expect(deriveVolunteerServiceType(result)).toBe("PRIMARY");
  });

  it("rejects active volunteer profiles without an operational capacity", () => {
    const result = updateVolunteerSchema.safeParse({
      active: true,
      canServeAsPrimary: false,
      canServeAsReplacement: false
    });

    expect(result.success).toBe(false);
  });

  it("derives replacement-only and primary-plus-replacement types", () => {
    expect(
      deriveVolunteerServiceType({
        canServeAsPrimary: false,
        canServeAsReplacement: true
      })
    ).toBe("REPLACEMENT");
    expect(
      deriveVolunteerServiceType({
        canServeAsPrimary: true,
        canServeAsReplacement: true
      })
    ).toBe("PRIMARY_AND_REPLACEMENT");
  });
});
