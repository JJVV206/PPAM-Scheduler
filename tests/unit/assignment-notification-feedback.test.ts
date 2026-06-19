import { describe, expect, it } from "vitest";

import {
  buildAssignmentNotificationFeedback,
  buildAssignmentNotificationNetworkErrorFeedback
} from "@/lib/notifications/assignment-notification-feedback";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function textResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html"
    }
  });
}

describe("assignment notification feedback", () => {
  it("formats successful request and reminder counts", async () => {
    await expect(
      buildAssignmentNotificationFeedback(
        jsonResponse({ sentCount: 2 }),
        "request"
      )
    ).resolves.toEqual({
      tone: "success",
      text: "Invitaciones pendientes enviadas (2)."
    });

    await expect(
      buildAssignmentNotificationFeedback(
        jsonResponse({ sentCount: 1 }),
        "reminder"
      )
    ).resolves.toEqual({
      tone: "success",
      text: "Emails reenviados (1)."
    });
  });

  it("keeps success usable when the body is not valid JSON", async () => {
    await expect(
      buildAssignmentNotificationFeedback(
        textResponse("<html>ok</html>", 200),
        "request"
      )
    ).resolves.toEqual({
      tone: "success",
      text: "Invitaciones pendientes enviadas."
    });
  });

  it("uses API error messages when JSON error payloads are valid", async () => {
    await expect(
      buildAssignmentNotificationFeedback(
        jsonResponse({ error: "Resend rejected the sender domain." }, 400),
        "request"
      )
    ).resolves.toEqual({
      tone: "error",
      text: "Resend rejected the sender domain."
    });
  });

  it("handles authentication and authorization failures explicitly", async () => {
    await expect(
      buildAssignmentNotificationFeedback(textResponse("", 401), "request")
    ).resolves.toEqual({
      tone: "error",
      text: "Tu sesión expiró. Inicia sesión de nuevo."
    });

    await expect(
      buildAssignmentNotificationFeedback(textResponse("", 403), "reminder")
    ).resolves.toEqual({
      tone: "error",
      text: "No tienes permisos para enviar emails de asignaciones."
    });
  });

  it("handles server errors with HTML or invalid JSON bodies", async () => {
    await expect(
      buildAssignmentNotificationFeedback(
        textResponse("<h1>Internal Server Error</h1>", 500),
        "request"
      )
    ).resolves.toEqual({
      tone: "error",
      text: "El servidor no pudo enviar el email. Revisa la configuración e intenta de nuevo."
    });

    await expect(
      buildAssignmentNotificationFeedback(
        new Response("{not-json", {
          status: 500,
          headers: {
            "content-type": "application/json"
          }
        }),
        "reminder"
      )
    ).resolves.toEqual({
      tone: "error",
      text: "El servidor no pudo enviar el email. Revisa la configuración e intenta de nuevo."
    });
  });

  it("provides a stable network error feedback", () => {
    expect(buildAssignmentNotificationNetworkErrorFeedback()).toEqual({
      tone: "error",
      text: "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo."
    });
  });
});
