import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendMail = vi.fn();
  const resendSend = vi.fn();
  const db = {
    notificationLog: {
      create: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  };

  return {
    db,
    getEmailDeliveryConfig: vi.fn(),
    resendSend,
    sendMail
  };
});

vi.mock("@/lib/db/prisma", () => ({ db: mocks.db }));
vi.mock("@/lib/env/config", () => ({
  getAppBaseUrl: () => "https://ppam.example.org",
  getEmailDeliveryConfig: mocks.getEmailDeliveryConfig
}));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mocks.sendMail
    }))
  }
}));
vi.mock("resend", () => ({
  Resend: vi.fn(function ResendMock() {
    return {
    emails: {
      send: mocks.resendSend
    }
    };
  })
}));

import { sendEmailNotification } from "@/services/notification.service";

describe("sendEmailNotification email providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "volunteer@example.org"
    });
    mocks.db.notificationLog.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "notification-log-1",
        ...data
      })
    );
  });

  it("sends through Resend API when configured", async () => {
    mocks.getEmailDeliveryConfig.mockReturnValue({
      provider: "resend",
      apiKey: "re_test",
      from: "PPAM <no-reply@ppam.services>"
    });
    mocks.resendSend.mockResolvedValue({
      data: {
        id: "email-1"
      },
      error: null
    });

    const log = await sendEmailNotification({
      userId: "user-1",
      type: "CONFIRMATION_REQUEST",
      subject: "Confirma tu asignacion",
      html: "<p>Confirma tu asignacion</p>",
      text: "Confirma tu asignacion"
    });

    expect(mocks.resendSend).toHaveBeenCalledWith({
      from: "PPAM <no-reply@ppam.services>",
      to: "volunteer@example.org",
      subject: "Confirma tu asignacion",
      html: "<p>Confirma tu asignacion</p>",
      text: "Confirma tu asignacion"
    });
    expect(log).toMatchObject({
      status: "SENT",
      metadata: {
        provider: "resend",
        providerMessageId: "email-1"
      }
    });
  });

  it("uses SMTP fallback when Resend is not configured", async () => {
    mocks.getEmailDeliveryConfig.mockReturnValue({
      provider: "smtp",
      from: "PPAM Scheduler <no-reply@ppam.local>",
      host: "localhost",
      port: 1025,
      secure: false,
      auth: undefined
    });
    mocks.sendMail.mockResolvedValue({});

    const log = await sendEmailNotification({
      userId: "user-1",
      type: "CONFIRMATION_REQUEST",
      subject: "Confirma tu asignacion",
      html: "<p>Confirma tu asignacion</p>"
    });

    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: "PPAM Scheduler <no-reply@ppam.local>",
      to: "volunteer@example.org",
      subject: "Confirma tu asignacion",
      html: "<p>Confirma tu asignacion</p>",
      text: undefined
    });
    expect(log).toMatchObject({
      status: "SENT",
      metadata: {
        provider: "smtp"
      }
    });
  });

  it("simulates email delivery only when no provider is configured", async () => {
    mocks.getEmailDeliveryConfig.mockReturnValue(null);

    const log = await sendEmailNotification({
      userId: "user-1",
      type: "CONFIRMATION_REQUEST",
      subject: "Confirma tu asignacion",
      html: "<p>Confirma tu asignacion</p>"
    });

    expect(mocks.resendSend).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(log).toMatchObject({
      status: "SENT",
      metadata: {
        simulated: true
      }
    });
  });
});
