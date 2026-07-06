export const e2eAssignmentFixtures = {
  emailInvitationToken: "e2e-email-flow-token",
  publicConfirmationToken: "e2e-public-confirmation-token",
  publicDeclineToken: "e2e-public-decline-token",
  publicExpiredToken: "e2e-public-expired-token",
  publicRespondedToken: "e2e-public-responded-token",
  volunteerAuthConfirmToken: "e2e-volunteer-auth-confirm-token",
  volunteerPendingToken: "e2e-volunteer-pending-token",
  weekLabel: "E2E QA Week"
} as const;

export const e2eAssignmentNotes = {
  emailFlow: "E2E email notification flow",
  publicConfirmation: "E2E public confirmation flow",
  publicDecline: "E2E public decline replacement flow",
  publicExpired: "E2E public expired token flow",
  publicResponded: "E2E public responded token flow",
  volunteerAuthConfirm: "E2E volunteer authenticated confirm flow",
  volunteerPending: "E2E volunteer pending flow"
} as const;
