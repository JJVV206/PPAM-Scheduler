import { describe, expect, it } from "vitest";

import {
  buildAssignmentConfirmationReceivedEmail,
  buildAssignmentReminderEmail,
  buildPrimaryAssignmentInvitationEmail,
  buildReplacementAssignmentInvitationEmail
} from "@/services/email-template.service";

const assignmentContext = {
  volunteerName: "Julia <Westbrook>",
  dateLabel: "Viernes, 12 de junio de 2026",
  timeSlotLabel: "11:00 - 13:00",
  pointName: "Hospital Dr Jose G. Parres"
};

describe("assignment email templates", () => {
  it("builds a formal primary invitation with CTA and fallback URL", () => {
    const email = buildPrimaryAssignmentInvitationEmail({
      ...assignmentContext,
      responseUrl: "https://ppam.example.org/confirm-assignment/token"
    });

    expect(email.subject).toBe("Confirma tu asignación de PPAM");
    expect(email.html).toContain("Hola Julia &lt;Westbrook&gt;");
    expect(email.html).toContain("pendiente de confirmación");
    expect(email.html).toContain("Confirmar o rechazar asignación");
    expect(email.html).toContain(
      "https://ppam.example.org/confirm-assignment/token"
    );
  });

  it("builds a replacement invitation with replacement-specific copy", () => {
    const email = buildReplacementAssignmentInvitationEmail({
      ...assignmentContext,
      responseUrl: "https://ppam.example.org/confirm-assignment/replacement"
    });

    expect(email.subject).toBe("Oportunidad de reemplazo PPAM");
    expect(email.html).toContain("necesita suplente");
    expect(email.html).toContain("Responder si puedes cubrirla");
    expect(email.html).toContain(
      "https://ppam.example.org/confirm-assignment/replacement"
    );
  });

  it("builds five-day and one-day reminder subjects from the same template", () => {
    const fiveDayEmail = buildAssignmentReminderEmail({
      ...assignmentContext,
      kind: "DAYS_BEFORE",
      offsetDays: 5,
      responseUrl: "https://ppam.example.org/volunteer/assignments/assignment-1"
    });
    const oneDayEmail = buildAssignmentReminderEmail({
      ...assignmentContext,
      kind: "DAYS_BEFORE",
      offsetDays: 1,
      responseUrl: "https://ppam.example.org/volunteer/assignments/assignment-1"
    });

    expect(fiveDayEmail.subject).toBe(
      "Recordatorio: asignación PPAM en 5 días"
    );
    expect(oneDayEmail.subject).toBe("Recordatorio: asignación PPAM mañana");
    expect(fiveDayEmail.html).toContain("Ver detalle de la asignación");
    expect(fiveDayEmail.html).toContain(
      "https://ppam.example.org/volunteer/assignments/assignment-1"
    );
  });

  it("builds final-hour and pending-confirmation reminders with explicit CTAs", () => {
    const finalReminder = buildAssignmentReminderEmail({
      ...assignmentContext,
      kind: "FINAL_HOURS",
      offsetHours: 3,
      responseUrl: "https://ppam.example.org/volunteer/assignments/assignment-1"
    });
    const pendingReminder = buildAssignmentReminderEmail({
      ...assignmentContext,
      kind: "PENDING_CONFIRMATION",
      offsetHours: 3,
      responseUrl: "https://ppam.example.org/confirm-assignment/token"
    });

    expect(finalReminder.subject).toBe(
      "Recordatorio final: asignación PPAM en 3 horas"
    );
    expect(finalReminder.html).toContain("recordatorio final");
    expect(pendingReminder.subject).toBe(
      "Pendiente: confirma tu asignación de PPAM"
    );
    expect(pendingReminder.html).toContain(
      "Confirmar o rechazar asignación"
    );
  });

  it("builds a confirmation received template ready for a future send flow", () => {
    const email = buildAssignmentConfirmationReceivedEmail({
      ...assignmentContext,
      assignmentUrl: "https://ppam.example.org/volunteer/assignments/assignment-1"
    });

    expect(email.subject).toBe("Confirmación recibida: asignación PPAM");
    expect(email.html).toContain("Recibimos tu confirmación");
    expect(email.html).toContain("Ver detalle de la asignación");
    expect(email.html).toContain(
      "https://ppam.example.org/volunteer/assignments/assignment-1"
    );
  });
});
