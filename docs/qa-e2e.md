# E2E QA

Playwright covers the critical PPAM service paths at browser/API level:

- public routes and unauthenticated protection
- admin login/session, dashboard, key pages, and admin APIs
- volunteer login/session, dashboard, key pages, and volunteer APIs
- role isolation between admin and volunteer APIs
- assignment list to canonical detail navigation
- admin email invitation send through Mailpit
- public assignment confirmation link
- volunteer pending assignment actions and detail
- public decline with replacement invitation through Mailpit
- expired and already-responded public assignment tokens
- authenticated volunteer availability save
- authenticated volunteer assignment confirmation
- authorized assignment automation cron smoke
- mobile and laptop overflow smoke for primary admin pages
- public assignment-token failure copy

## Local setup

Start or prepare the local database first. If Docker maps Postgres to the
default local port:

```bash
npm run db:start
npm run db:push
```

If the Docker app stack is using the common local override from this project,
use port `5433` for seed and tests:

```bash
APP_PORT=3002 NEXTAUTH_URL=http://localhost:3002 POSTGRES_HOST_PORT=5433 npm run docker:dev
```

Install Playwright's browser runtime once per machine:

```bash
npm run e2e:install
```

Seed E2E-only users and fixed point data:

```bash
ALLOW_E2E_DATA_WRITE=true npm run e2e:data:seed
```

With the Docker port override:

```bash
ALLOW_E2E_DATA_WRITE=true \
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
npm run e2e:data:seed
```

The seed is scoped to these default users:

```txt
e2e+ppam-admin@example.invalid / E2EAdmin123!
e2e+ppam-volunteer@example.invalid / E2EVolunteer123!
e2e+ppam-replacement@example.invalid / E2EReplacement123!
```

The seed also recreates one deterministic E2E week with isolated assignments
for:

- admin email invitation and Mailpit assertion
- public confirmation token
- volunteer pending-assignment UI

Override credentials with:

```bash
E2E_ADMIN_EMAIL="admin@example.com"
E2E_ADMIN_PASSWORD="admin-password"
E2E_VOLUNTEER_EMAIL="volunteer@example.com"
E2E_VOLUNTEER_PASSWORD="volunteer-password"
E2E_REPLACEMENT_EMAIL="replacement@example.com"
E2E_REPLACEMENT_PASSWORD="replacement-password"
```

## Running tests

Run the full suite:

```bash
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:critical
npm run test:e2e:cross-browser
```

With the Docker port override:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
npm run test:e2e
```

Run one project:

```bash
npm run test:e2e -- --project=public-chromium
npm run test:e2e -- --project=admin-chromium
npm run test:e2e -- --project=volunteer-chromium
npm run test:e2e -- --project=responsive-chromium
npm run test:e2e -- --project=critical-regression
```

Run production-safe read-only smoke against a deployed environment:

```bash
E2E_BASE_URL="https://YOUR_PRODUCTION_URL" npm run test:e2e:prod
```

`test:e2e:cross-browser` enables opt-in Firefox/WebKit projects through
`E2E_CROSS_BROWSER=true`. Install those browsers first when running it locally:

```bash
npx playwright install firefox webkit
```

Use an already running server:

```bash
E2E_BASE_URL="http://localhost:3000" npm run test:e2e
```

By default Playwright starts:

```bash
npm run dev -- --hostname localhost --port 3100
```

The managed server does not reuse an existing process by default. To opt into
reuse for a manually managed local server, set:

```bash
E2E_REUSE_SERVER=true npm run test:e2e
```

## Mailpit

Mailpit is the local SMTP inbox used by E2E email tests.

```txt
SMTP server: localhost:1025
Inbox UI: http://localhost:8025
API base: http://localhost:8025/api/v1
```

Playwright config injects these SMTP defaults into the managed dev server:

```txt
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=PPAM Scheduler <no-reply@ppam.local>
```

The email test clears Mailpit before sending:

```bash
curl -X DELETE http://localhost:8025/api/v1/messages
```

If Mailpit is not running, start the Docker stack before running E2E. Do not
point local E2E at Resend; production provider behavior is covered by config
and health readiness checks, while Mailpit keeps local tests deterministic and
free.

## Tags

Use Playwright grep tags for focused runs:

```txt
@smoke      PR-safe core UI/API coverage
@critical   service-critical API and workflow coverage
@write      mutates the non-production database
@email      depends on Mailpit
@responsive viewport and overflow checks
@prod-safe  read-only checks allowed against production-like deployments
```

Do not run `@write` tests against production.

## CI

`.github/workflows/e2e.yml` runs the smoke suite on pull requests with:

- Postgres 16 service
- Mailpit service
- `npm ci`
- `npx playwright install --with-deps chromium`
- `npm run db:push`
- `npm run e2e:data:seed`
- `npm run test:e2e:smoke`
- `npm run e2e:data:cleanup`
- Playwright report and trace artifact upload

## Cleanup

Cleanup removes the deterministic E2E week and users matching
`e2e+ppam-...@example.invalid`:

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
- Re-run `ALLOW_E2E_DATA_WRITE=true npm run e2e:data:seed` before the full
  suite when a test consumes a one-time token.
- Use `test:e2e:prod` only for read-only production smoke. Full E2E requires
  isolated non-production data.
