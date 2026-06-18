# E2E QA

Playwright covers the critical PPAM service paths at browser/API level:

- public routes and unauthenticated protection
- admin login/session, dashboard, key pages, and admin APIs
- volunteer login/session, dashboard, key pages, and volunteer APIs
- role isolation between admin and volunteer APIs
- mobile overflow smoke for primary admin pages
- public assignment-token failure copy

## Local setup

Start or prepare the local database first:

```bash
npm run db:start
npm run db:push
```

Install Playwright's browser runtime once per machine:

```bash
npx playwright install chromium
```

Seed E2E-only users and fixed point data:

```bash
ALLOW_E2E_DATA_WRITE=true npm run e2e:data:seed
```

The seed is scoped to these default users:

```txt
e2e+ppam-admin@example.invalid / E2EAdmin123!
e2e+ppam-volunteer@example.invalid / E2EVolunteer123!
```

Override credentials with:

```bash
E2E_ADMIN_EMAIL="admin@example.com"
E2E_ADMIN_PASSWORD="admin-password"
E2E_VOLUNTEER_EMAIL="volunteer@example.com"
E2E_VOLUNTEER_PASSWORD="volunteer-password"
```

## Running tests

Run the full suite:

```bash
npm run test:e2e
```

Run one project:

```bash
npm run test:e2e -- --project=public-chromium
npm run test:e2e -- --project=admin-chromium
npm run test:e2e -- --project=volunteer-chromium
npm run test:e2e -- --project=admin-mobile
```

Use an already running server:

```bash
E2E_BASE_URL="http://localhost:3000" npm run test:e2e
```

By default Playwright starts:

```bash
npm run dev -- --hostname localhost --port 3100
```

## Cleanup

Cleanup only removes users matching `e2e+ppam-...@example.invalid`:

```bash
ALLOW_E2E_DATA_WRITE=true npm run e2e:data:cleanup
```

## Notes

- The E2E suite assumes a non-production database.
- Authenticated specs depend on `auth.setup.ts`, which writes browser session
  state under `tests/e2e/.auth`.
- Reports and traces are ignored by git: `playwright-report`, `test-results`,
  and `tests/e2e/.auth`.
- Add future write-heavy scenarios behind dedicated E2E seed data and cleanup;
  do not reuse real volunteer data.
