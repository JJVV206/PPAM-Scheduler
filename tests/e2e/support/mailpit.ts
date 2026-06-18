import { expect, type APIRequestContext } from "@playwright/test";

type MailpitAddress = {
  Address: string;
  Name?: string;
};

type MailpitMessageSummary = {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
  Created: string;
};

type MailpitMessageList = {
  messages: MailpitMessageSummary[];
};

type MailpitMessageDetail = {
  HTML?: string;
  Text?: string;
};

const defaultMailpitUrl = "http://localhost:8025";

export function getMailpitUrl() {
  return process.env.E2E_MAILPIT_URL ?? defaultMailpitUrl;
}

export async function clearMailpitInbox(request: APIRequestContext) {
  const response = await request.delete(`${getMailpitUrl()}/api/v1/messages`);

  expect(response.ok()).toBeTruthy();
}

export async function waitForMailpitMessage(
  request: APIRequestContext,
  input: {
    subject: string;
    to: string;
    createdAfter: Date;
    timeoutMs?: number;
  }
) {
  const timeoutMs = input.timeoutMs ?? 20_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await request.get(`${getMailpitUrl()}/api/v1/messages`);

    if (response.ok()) {
      const body = (await response.json()) as MailpitMessageList;
      const message = body.messages.find((item) => {
        const createdAt = new Date(item.Created);

        return (
          item.Subject === input.subject &&
          item.To.some((recipient) => recipient.Address === input.to) &&
          createdAt >= input.createdAfter
        );
      });

      if (message) {
        return message;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Mailpit message not found for ${input.to} with subject "${input.subject}".`
  );
}

export async function getMailpitMessageDetail(
  request: APIRequestContext,
  id: string
) {
  const response = await request.get(
    `${getMailpitUrl()}/api/v1/message/${encodeURIComponent(id)}`
  );

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as MailpitMessageDetail;
}
