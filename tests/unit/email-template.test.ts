import { describe, expect, it } from "vitest";

import {
  buildAdminAssignmentAlertEmail,
  buildAssignmentConfirmationReceivedEmail,
  buildAssignmentReminderEmail,
  buildPrimaryAssignmentInvitationEmail,
  buildReplacementAssignmentInvitationEmail,
  buildReplacementCensusInvitationEmail,
  buildReplacementCensusReminderEmail,
  type EmailTemplate
} from "@/services/email-template.service";

const assignmentContext = {
  volunteerName: "Julia <Westbrook>",
  dateLabel: "Viernes, 12 de junio de 2026",
  timeSlotLabel: "11:00 - 13:00",
  pointName: "Hospital Dr Jose G. Parres"
};

function expectTemplateContract(email: EmailTemplate, url?: string) {
  expect(email.subject.length).toBeGreaterThan(10);
  expect(email.html).toContain("<p>");
  expect(email.text.length).toBeGreaterThan(20);

  if (url) {
    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
  }
}

describe("assignment email templates", () => {
  it("builds a formal primary invitation with CTA and fallback URL", () => {
    const responseUrl = "https://ppam.example.org/confirm-assignment/token";
    const email = buildPrimaryAssignmentInvitationEmail({
      ...assignmentContext,
      responseUrl
    });

    expect(email.subject).toBe("Confirma tu asignación titular de PPAM");
    expect(email.html).toContain("Hola Julia &lt;Westbrook&gt;");
    expect(email.html).toContain("pendiente de confirmación");
    expect(email.html).toContain("Confirmar o rechazar asignación");
    expect(email.text).toContain("Fecha: Viernes, 12 de junio de 2026");
    expectTemplateContract(email, responseUrl);
  });

  it("builds a replacement invitation with replacement-specific copy", () => {
    const responseUrl =
      "https://ppam.example.org/confirm-assignment/replacement";
    const email = buildReplacementAssignmentInvitationEmail({
      ...assignmentContext,
      responseUrl
    });

    expect(email.subject).toBe("Invitación para cubrir como suplente en PPAM");
    expect(email.html).toContain("necesita suplente");
    expect(email.html).toContain("Responder si puedes cubrirla");
    expectTemplateContract(email, responseUrl);
  });

  it("builds weekly census invitation and reminder templates", () => {
    const responseUrl = "https://ppam.example.org/replacement-census/token";
    const input = {
      volunteerName: "Marco Davis",
      weekLabel: "semana del 15 al 21 de junio",
      closesAtLabel: "18 de junio de 2026, 20:00",
      responseUrl
    };
    const invitation = buildReplacementCensusInvitationEmail(input);
    const reminder = buildReplacementCensusReminderEmail(input);

    expect(invitation.subject).toBe("Censo semanal de suplentes PPAM");
    expect(invitation.html).toContain("horario específico");
    expect(invitation.text).toContain("Fecha límite");
    expect(reminder.subject).toBe(
      "Recordatorio: responde el censo semanal de suplentes"
    );
    expect(reminder.html).toContain("sigue pendiente");
    expectTemplateContract(invitation, responseUrl);
    expectTemplateContract(reminder, responseUrl);
  });

  it("builds five-day, one-day, and final assignment reminders", () => {
    const responseUrl =
      "https://ppam.example.org/volunteer/assignments/assignment-1";
    const fiveDayEmail = buildAssignmentReminderEmail({
      ...assignmentContext,
      kind: "DAYS_BEFORE",
      offsetDays: 5,
      responseUrl
    });
    const oneDayEmail = buildAssignmentReminderEmail({
      ...assignmentContext,
      kind: "DAYS_BEFORE",
      offsetDays: 1,
      responseUrl
    });
    const finalReminder = buildAssignmentReminderEmail({
      ...assignmentContext,
      kind: "FINAL_HOURS",
      offsetHours: 3,
      responseUrl
    });

    expect(fiveDayEmail.subject).toBe(
      "Recordatorio: asignación PPAM en 5 días"
    );
    expect(oneDayEmail.subject).toBe("Recordatorio: asignación PPAM mañana");
    expect(finalReminder.subject).toBe(
      "Recordatorio final: asignación PPAM en 3 horas"
    );
    expect(finalReminder.html).toContain("recordatorio final");
    expectTemplateContract(fiveDayEmail, responseUrl);
    expectTemplateContract(oneDayEmail, responseUrl);
    expectTemplateContract(finalReminder, responseUrl);
  });

  it("builds distinct primary reminder subjects for 12h, 24h, and 40h", () => {
    const responseUrl = "https://ppam.example.org/confirm-assignment/token";

    for (const offsetHours of [12, 24, 40]) {
      const email = buildAssignmentReminderEmail({
        ...assignmentContext,
        kind: "PENDING_CONFIRMATION",
        invitationType: "PRIMARY",
        offsetHours,
        responseUrl
      });

      expect(email.subject).toBe(
        `Recordatorio titular ${offsetHours}h: confirma tu asignación`
      );
      expect(email.html).toContain("asignación titular sigue pendiente");
      expectTemplateContract(email, responseUrl);
    }
  });

  it("builds distinct replacement reminder subjects for 4h and 8h", () => {
    const responseUrl =
      "https://ppam.example.org/confirm-assignment/replacement-token";

    for (const offsetHours of [4, 8]) {
      const email = buildAssignmentReminderEmail({
        ...assignmentContext,
        kind: "PENDING_CONFIRMATION",
        invitationType: "REPLACEMENT",
        offsetHours,
        responseUrl
      });

      expect(email.subject).toBe(
        `Recordatorio suplente ${offsetHours}h: responde si puedes cubrir`
      );
      expect(email.html).toContain("invitación para cubrir como suplente");
      expectTemplateContract(email, responseUrl);
    }
  });

  it("builds a confirmation received template ready for a future send flow", () => {
    const assignmentUrl =
      "https://ppam.example.org/volunteer/assignments/assignment-1";
    const email = buildAssignmentConfirmationReceivedEmail({
      ...assignmentContext,
      assignmentUrl
    });

    expect(email.subject).toBe("Confirmación recibida: asignación PPAM");
    expect(email.html).toContain("Recibimos tu confirmación");
    expect(email.html).toContain("Ver detalle de la asignación");
    expectTemplateContract(email, assignmentUrl);
  });

  it("builds an admin intervention alert with operational context", () => {
    const assignmentUrl =
      "https://ppam.example.org/admin/assignments/assignment-1";
    const email = buildAdminAssignmentAlertEmail({
      reason: "NO_REPLACEMENT_AVAILABLE",
      reasonLabel: "No hay suplentes disponibles.",
      dateLabel: "viernes 12 de junio",
      timeSlotLabel: "11:00 - 13:00",
      pointName: "Hospital Dr Jose G. Parres",
      originalVolunteerNames: ["Julia", "Marco"],
      attemptedReplacementNames: ["Elena"],
      assignmentUrl
    });

    expect(email.subject).toContain("Alerta admin");
    expect(email.html).toContain("No hay suplentes disponibles.");
    expect(email.html).toContain("Julia, Marco");
    expect(email.html).toContain("Elena");
    expect(email.text).toContain("Problema: No hay suplentes disponibles.");
    expectTemplateContract(email, assignmentUrl);
  });

  it("builds an email-failure alert without exposing token metadata", () => {
    const assignmentUrl =
      "https://ppam.example.org/admin/assignments/assignment-1";
    const email = buildAdminAssignmentAlertEmail({
      reason: "INVITATION_EMAIL_FAILED",
      reasonLabel: "Falló el envío de email a un suplente.",
      dateLabel: "viernes 12 de junio",
      timeSlotLabel: "11:00 - 13:00",
      pointName: "Hospital Dr Jose G. Parres",
      originalVolunteerNames: ["Julia"],
      attemptedReplacementNames: [],
      assignmentUrl,
      affectedVolunteerName: "Elena",
      invitationType: "REPLACEMENT",
      errorMessage: "SMTP rejected recipient"
    });

    expect(email.subject).toContain("fallo de email");
    expect(email.html).toContain("Elena");
    expect(email.html).toContain("Suplente");
    expect(email.html).toContain("SMTP rejected recipient");
    expect(email.text).not.toContain("token");
    expectTemplateContract(email, assignmentUrl);
  });
});
