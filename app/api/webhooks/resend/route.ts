import { handleRouteError, ok } from "@/lib/utils/api";
import { processResendWebhook } from "@/services/email-webhook.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await processResendWebhook({
      body: await request.text(),
      headers: request.headers
    });

    if (result.status === "invalid_signature") {
      return ok({ error: "Invalid webhook signature" }, { status: 400 });
    }

    if (result.status === "invalid_payload") {
      return ok({ error: "Invalid webhook payload" }, { status: 400 });
    }

    if (result.status === "missing_secret") {
      return ok(
        { error: "Resend webhook secret is not configured" },
        { status: 503 }
      );
    }

    return ok({
      eventId: result.eventId,
      eventType: result.eventType,
      notificationLogId: result.notificationLogId,
      providerMessageId: result.providerMessageId,
      status: result.status,
      updatedStatus: result.updatedStatus
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
