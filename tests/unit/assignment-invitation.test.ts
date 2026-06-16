import { afterEach, describe, expect, it } from "vitest";

import {
  ACTIVE_ASSIGNMENT_INVITATION_STATUSES,
  buildAssignmentInvitationResponseUrl,
  buildPrimaryAssignmentInvitationEmail
} from "@/services/assignment-invitation.service";

const originalNextAuthUrl = process.env.NEXTAUTH_URL;

afterEach(() => {
  if (originalNextAuthUrl === undefined) {
    delete process.env.NEXTAUTH_URL;
    return;
  }

  process.env.NEXTAUTH_URL = originalNextAuthUrl;
});

describe("assignment invitation helpers", () => {
  it("treats pending and sent invitations as active", () => {
    expect(ACTIVE_ASSIGNMENT_INVITATION_STATUSES).toEqual(["PENDING", "SENT"]);
  });

  it("builds token-based response URLs for the public confirmation screen", () => {
    process.env.NEXTAUTH_URL = "https://ppam.example.org/";

    expect(buildAssignmentInvitationResponseUrl("abc 123")).toBe(
      "https://ppam.example.org/confirm-assignment/abc%20123"
    );
  });

  it("builds the primary invitation email with assignment context and fallback URL", () => {
    const email = buildPrimaryAssignmentInvitationEmail({
      volunteerName: "Julia <Westbrook>",
      dateLabel: "Viernes, 12 de junio de 2026",
      timeSlotLabel: "11:00 - 13:00",
      pointName: "Hospital Dr Jose G. Parres",
      responseUrl: "https://ppam.example.org/confirm-assignment/token"
    });

    expect(email.subject).toBe("Confirma tu asignación de PPAM");
    expect(email.html).toContain("Julia &lt;Westbrook&gt;");
    expect(email.html).toContain("Viernes, 12 de junio de 2026");
    expect(email.html).toContain("11:00 - 13:00");
    expect(email.html).toContain("Hospital Dr Jose G. Parres");
    expect(email.html).toContain("Confirmar o rechazar asignación");
    expect(email.html).toContain(
      "https://ppam.example.org/confirm-assignment/token"
    );
  });
});
