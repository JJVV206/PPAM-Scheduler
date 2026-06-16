import { timingSafeEqual } from "node:crypto";

function safeStringEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthorizedCronRequest(input: {
  authorizationHeader: string | null;
  cronSecret?: string;
}) {
  if (!input.authorizationHeader || !input.cronSecret) {
    return false;
  }

  return safeStringEquals(
    input.authorizationHeader,
    `Bearer ${input.cronSecret}`
  );
}
