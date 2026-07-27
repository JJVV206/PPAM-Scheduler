import { test as base } from "@playwright/test";

import {
  e2eAdmissionFixtures,
  e2eAssignmentFixtures,
  e2eAssignmentNotes
} from "./fixtures";
import {
  clearMailpitInbox,
  getMailpitMessageDetail,
  waitForMailpitMessage
} from "./mailpit";
import { AdminAssignmentsPage } from "./pages/admin-assignments-page";
import { PublicConfirmationPage } from "./pages/public-confirmation-page";
import { VolunteerAssignmentsPage } from "./pages/volunteer-assignments-page";

type E2eFixtures = {
  adminAssignmentsPage: AdminAssignmentsPage;
  e2eData: {
    admissions: typeof e2eAdmissionFixtures;
    fixtures: typeof e2eAssignmentFixtures;
    notes: typeof e2eAssignmentNotes;
  };
  mailpit: {
    clearInbox: typeof clearMailpitInbox;
    getMessageDetail: typeof getMailpitMessageDetail;
    waitForMessage: typeof waitForMailpitMessage;
  };
  publicConfirmationPage: PublicConfirmationPage;
  volunteerAssignmentsPage: VolunteerAssignmentsPage;
};

export const test = base.extend<E2eFixtures>({
  adminAssignmentsPage: async ({ page }, use) => {
    await use(new AdminAssignmentsPage(page));
  },
  e2eData: async ({}, use) => {
    await use({
      admissions: e2eAdmissionFixtures,
      fixtures: e2eAssignmentFixtures,
      notes: e2eAssignmentNotes
    });
  },
  mailpit: async ({}, use) => {
    await use({
      clearInbox: clearMailpitInbox,
      getMessageDetail: getMailpitMessageDetail,
      waitForMessage: waitForMailpitMessage
    });
  },
  publicConfirmationPage: async ({ page }, use) => {
    await use(new PublicConfirmationPage(page));
  },
  volunteerAssignmentsPage: async ({ page }, use) => {
    await use(new VolunteerAssignmentsPage(page));
  }
});

export { expect } from "@playwright/test";
