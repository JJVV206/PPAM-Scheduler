import { afterEach, describe, expect, it } from "vitest";

import {
  ACTIVE_ASSIGNMENT_INVITATION_STATUSES,
  buildAssignmentInvitationResponseUrl,
  buildPrimaryAssignmentInvitationEmail,
  buildReplacementAssignmentInvitationEmail,
  getAssignmentInvitationAvailability
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

    expect(email.subject).toBe("Confirma tu asignación titular de PPAM");
    expect(email.html).toContain("Julia &lt;Westbrook&gt;");
    expect(email.html).toContain("Viernes, 12 de junio de 2026");
    expect(email.html).toContain("11:00 - 13:00");
    expect(email.html).toContain("Hospital Dr Jose G. Parres");
    expect(email.html).toContain("Confirmar o rechazar asignación");
    expect(email.html).toContain(
      "https://ppam.example.org/confirm-assignment/token"
    );
  });

  it("builds replacement invitation emails with replacement-specific copy", () => {
    const email = buildReplacementAssignmentInvitationEmail({
      volunteerName: "Marco Davis",
      dateLabel: "Viernes, 12 de junio de 2026",
      timeSlotLabel: "11:00 - 13:00",
      pointName: "Hospital Dr Jose G. Parres",
      responseUrl: "https://ppam.example.org/confirm-assignment/replacement-token"
    });

    expect(email.subject).toBe("Invitación para cubrir como suplente en PPAM");
    expect(email.html).toContain("necesita suplente");
    expect(email.html).toContain("Responder si puedes cubrirla");
    expect(email.html).toContain(
      "https://ppam.example.org/confirm-assignment/replacement-token"
    );
  });

  it("detects expired, responded, failed, and ready invitation states", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");

    expect(
      getAssignmentInvitationAvailability({
        status: "SENT",
        expiresAt: new Date("2026-06-12T11:59:59.000Z"),
        now
      })
    ).toBe("EXPIRED");
    expect(
      getAssignmentInvitationAvailability({
        status: "ACCEPTED",
        expiresAt: new Date("2026-06-13T12:00:00.000Z"),
        respondedAt: new Date("2026-06-12T10:00:00.000Z"),
        now
      })
    ).toBe("RESPONDED");
    expect(
      getAssignmentInvitationAvailability({
        status: "FAILED",
        expiresAt: new Date("2026-06-13T12:00:00.000Z"),
        now
      })
    ).toBe("FAILED");
    expect(
      getAssignmentInvitationAvailability({
        status: "SENT",
        expiresAt: new Date("2026-06-13T12:00:00.000Z"),
        now
      })
    ).toBe("READY");
  });
});
