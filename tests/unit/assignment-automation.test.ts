import { describe, expect, it } from "vitest";

import {
  buildAdminAssignmentAlertEmail,
  buildAssignmentStartDate,
  getDueConfirmedAssignmentReminder,
  getDuePendingConfirmationReminder,
  normalizeReminderTimingDays,
} from "@/services/assignment-automation.service";

describe("assignment reminder scheduling", () => {
  it("normalizes reminder timing days into a positive ascending cadence", () => {
    expect(normalizeReminderTimingDays([1, 5, 1, 0, -2])).toEqual([1, 5]);
  });

  it("combines assignment date with the time slot start", () => {
    expect(
      buildAssignmentStartDate({
        date: new Date(2026, 5, 20),
        timeSlot: "SLOT_11_13"
      }).getHours()
    ).toBe(11);
  });

  it("selects the five-day reminder once it is due", () => {
    const reminder = getDueConfirmedAssignmentReminder({
      assignmentDate: new Date(2026, 5, 20),
      timeSlot: "SLOT_11_13",
      now: new Date(2026, 5, 15, 11, 0, 0),
      reminderTimingDays: [5, 1],
      finalReminderHours: 3
    });

    expect(reminder).toMatchObject({
      kind: "DAYS_BEFORE",
      reminderKey: "confirmed-5d",
      notificationType: "REMINDER",
      offsetDays: 5
    });
  });

  it("prioritizes the final hours reminder over day reminders", () => {
    const reminder = getDueConfirmedAssignmentReminder({
      assignmentDate: new Date(2026, 5, 20),
      timeSlot: "SLOT_11_13",
      now: new Date(2026, 5, 20, 8, 30, 0),
      reminderTimingDays: [5, 1],
      finalReminderHours: 3
    });

    expect(reminder).toMatchObject({
      kind: "FINAL_HOURS",
      reminderKey: "confirmed-final-3h",
      notificationType: "FINAL_REMINDER",
      offsetHours: 3
    });
  });

  it("schedules pending confirmation reminders before invitation expiration", () => {
    const reminder = getDuePendingConfirmationReminder({
      invitationId: "invitation-1",
      expiresAt: new Date("2026-06-16T18:00:00.000Z"),
      now: new Date("2026-06-16T15:30:00.000Z"),
      finalReminderHours: 3
    });

    expect(reminder).toMatchObject({
      kind: "PENDING_CONFIRMATION",
      reminderKey: "pending-confirmation-invitation-1",
      notificationType: "REMINDER",
      offsetHours: 3
    });
  });
});

describe("admin assignment alert emails", () => {
  it("includes the required operational context and assignment detail link", () => {
    const email = buildAdminAssignmentAlertEmail({
      reason: "NO_REPLACEMENT_AVAILABLE",
      reasonLabel: "No hay suplentes disponibles.",
      dateLabel: "viernes 12 de junio",
      timeSlotLabel: "11:00 - 13:00",
      pointName: "Hospital Dr Jose G. Parres",
      originalVolunteerNames: ["Julia", "Marco"],
      attemptedReplacementNames: ["Elena"],
      assignmentUrl: "https://ppam.example.org/admin/assignments/assignment-1"
    });

    expect(email.subject).toContain("Urgente");
    expect(email.html).toContain("viernes 12 de junio");
    expect(email.html).toContain("11:00 - 13:00");
    expect(email.html).toContain("Hospital Dr Jose G. Parres");
    expect(email.html).toContain("Julia, Marco");
    expect(email.html).toContain("Elena");
    expect(email.html).toContain("No hay suplentes disponibles.");
    expect(email.html).toContain(
      "https://ppam.example.org/admin/assignments/assignment-1"
    );
  });

  it("includes failed invitation details when a critical email fails", () => {
    const email = buildAdminAssignmentAlertEmail({
      reason: "INVITATION_EMAIL_FAILED",
      reasonLabel: "Falló el envío de email a un suplente.",
      dateLabel: "viernes 12 de junio",
      timeSlotLabel: "11:00 - 13:00",
      pointName: "Hospital Dr Jose G. Parres",
      originalVolunteerNames: ["Julia"],
      attemptedReplacementNames: [],
      assignmentUrl: "https://ppam.example.org/admin/assignments/assignment-1",
      affectedVolunteerName: "Elena",
      invitationType: "REPLACEMENT",
      errorMessage: "SMTP rejected recipient"
    });

    expect(email.subject).toContain("fallo de email");
    expect(email.html).toContain("Elena");
    expect(email.html).toContain("Suplente");
    expect(email.html).toContain("SMTP rejected recipient");
    expect(email.html).toContain("Ninguno");
  });
});
