# QA Checklist

Use this checklist before deploys and after changes touching scheduling,
assignments, volunteers, auth, email delivery, automation, or responsive UI.

## Severity Guide

- P0: production outage, data loss, auth bypass, or destructive automation.
- P1: critical user flow blocked for admin or volunteers.
- P2: degraded workflow, incorrect state, broken email, or serious UI issue.
- P3: minor copy, visual polish, or low-risk edge case.

## Automated Gates

```bash
npm run lint
npm run test
npm run typecheck
ALLOW_E2E_DATA_WRITE=true npm run e2e:data:seed
npm run test:e2e:smoke
npm run test:e2e:critical
ALLOW_E2E_DATA_WRITE=true npm run e2e:data:cleanup
```

For production-like read-only validation:

```bash
E2E_BASE_URL="https://YOUR_PRODUCTION_URL" npm run test:e2e:prod
```

## Functional QA

- Public: login loads, protected routes redirect, invalid/expired/responded
  assignment tokens show safe copy.
- Admin: dashboard, schedule, assignments, assignment detail, open slots,
  volunteers, points, replacements, notifications, and settings load.
- Admin APIs: dashboard, settings, points, volunteers, assignments, open slots,
  and schedule return expected statuses.
- Volunteer: dashboard, assignments, assignment detail, availability, profile,
  open slots, and notifications load.
- Role isolation: volunteers cannot access admin pages or admin APIs.
- Email: primary invitations and replacement invitations arrive in Mailpit with
  a confirmation URL.
- Automation: cron rejects missing secret and succeeds with `CRON_SECRET` in a
  non-production database.

## Visual And Responsive QA

- Check mobile and laptop viewports for horizontal overflow.
- Confirm side navigation/top navigation remain usable on protected pages.
- Confirm cards, tables, dialogs, buttons, and empty states do not overlap or
  truncate action text.
- Capture screenshots or traces for every P1/P2 visual regression.

## Manual Regression Focus

- Create or duplicate a schedule week.
- Send pending invitations.
- Confirm and decline assignment links.
- Trigger replacement flow when a volunteer declines.
- Save volunteer availability and temporary unavailable status.
- Review admin attention/replacement notifications.
- Verify Mailpit email body links and fallback URL text.

## Release Report Template

```txt
Scope:
Environment:
Seed data:
Automated tests:
Manual tests:
P0/P1 findings:
P2 findings:
P3 findings:
Not tested:
Residual risk:
Decision:
```
