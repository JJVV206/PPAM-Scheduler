export function isAuthorizedCronRequest(input: {
  authorizationHeader: string | null;
  cronSecret?: string;
}) {
  if (!input.cronSecret) {
    return false;
  }

  return input.authorizationHeader === `Bearer ${input.cronSecret}`;
}
