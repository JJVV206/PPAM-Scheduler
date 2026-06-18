# Deploy to Vercel with Neon

This app uses Vercel for Next.js hosting and Neon Postgres for the production database.

## 1. Neon

Create or select the production Neon project and branch.

Use two connection strings:

- `DATABASE_URL`: pooled connection string for Vercel runtime queries.
- `DIRECT_URL`: direct connection string for Prisma migrations.

The pooled URL usually includes `-pooler` in the host and `pgbouncer=true`.
The direct URL does not use the pooler host.

## 2. Vercel environment variables

Add these variables in Vercel Project Settings -> Environment Variables for
Production:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CRON_SECRET`
- `RESEND_API_KEY` when using Resend API for production email
- `RESEND_FROM` when using Resend API for production email
- `SMTP_HOST` only when using SMTP fallback instead of Resend
- `SMTP_PORT` only when using SMTP fallback instead of Resend
- `SMTP_SECURE` only when using SMTP fallback instead of Resend
- `SMTP_USER` only when the SMTP provider requires auth
- `SMTP_PASS` only when the SMTP provider requires auth
- `SMTP_FROM` only when using SMTP fallback instead of Resend

Generate `NEXTAUTH_SECRET` with:

```bash
openssl rand -base64 32
```

Generate `CRON_SECRET` the same way. Vercel will call `/api/cron/assignment-automation`
once per day on Hobby projects and must send `Authorization: Bearer $CRON_SECRET`.
Use Vercel Pro or an external scheduler if production needs the automation to
run more frequently than daily.
The cron response intentionally exposes only an operational summary, not step
details, email metadata, tokens, or internal error messages.

Set `NEXTAUTH_URL` to the final production URL, for example:

```text
https://ppam-scheduler.vercel.app
```

Use Resend API for production email when possible:

```text
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM=PPAM <no-reply@ppam.services>
```

Replace `re_xxxxxxxxx` with the real API key from Resend. For a first free-plan
test, Resend allows `onboarding@resend.dev` only for approved test recipients.
Before sending invitations to real volunteers, verify `ppam.services` in Resend
and use a sender from that domain. SMTP variables are optional fallback values
when `RESEND_API_KEY` and `RESEND_FROM` are not configured.

Do not configure production to use Mailpit. Mailpit is local-only and should
only be used through:

```txt
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=PPAM Scheduler <no-reply@ppam.local>
```

Use `docs/qa-e2e.md` for the local Mailpit validation workflow.

## 3. Apply migrations

Run migrations against Neon before the first production deploy and whenever schema changes are released:

```bash
DATABASE_URL="PASTE_NEON_POOLED_URL" DIRECT_URL="PASTE_NEON_DIRECT_URL" npm run prod:migrate
```

Do not run `npm run db:push` or `npm run db:seed` against production.

## 4. Deploy

Vercel uses `npm run vercel:build`, which runs the production migrations before building when `VERCEL_ENV=production`:

```bash
node scripts/vercel-build.mjs
```

The build script requires non-empty `DATABASE_URL` and `DIRECT_URL` in production. If either variable is missing, the deploy fails before publishing so the app cannot run against an unmigrated schema. For preview and local builds, migrations are skipped automatically. To bypass migrations intentionally, set `SKIP_PRISMA_MIGRATE=1`.

After deploy, verify:

```text
https://YOUR_PRODUCTION_URL/api/health
```

Expected core result:

```json
{
  "checks": {
    "appEnv": "ok",
    "database": "ok"
  },
  "scope": "core",
  "status": "ok"
}
```

`/api/health` checks only app env and database so uptime monitors do not fail
because email is temporarily degraded. To require email readiness too, verify:

```text
https://YOUR_PRODUCTION_URL/api/health?scope=readiness
```

That endpoint should return `200` only when Resend API or SMTP is configured correctly.

## 5. First admin user

Production should not be seeded with demo users. Create or update the first admin with the one-off script:

```bash
DATABASE_URL="PASTE_NEON_POOLED_URL" \
DIRECT_URL="PASTE_NEON_DIRECT_URL" \
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="use-a-long-random-password" \
ADMIN_NAME="PPAM Admin" \
npm run prod:create-admin
```

The script is idempotent for admin users. It also creates the fixed preaching point `Hospital Dr José G. Parres` when the database is empty.

## 6. Production smoke QA

Run read-only smoke QA after every deployment:

```bash
QA_BASE_URL="https://YOUR_PRODUCTION_URL" \
QA_ADMIN_EMAIL="admin@example.com" \
QA_ADMIN_PASSWORD="admin-password" \
npm run qa:smoke
```

Use `QA_REQUIRE_EMAIL_READY=true` when SMTP must be part of the gate:

```bash
QA_REQUIRE_EMAIL_READY=true npm run qa:smoke
```

Production smoke QA intentionally avoids creating assignments or sending
emails. Validate one controlled production email manually with a test volunteer
after Resend domain verification is complete.

## 7. Controlled QA data

QA write scripts are disabled unless you explicitly opt in:

```bash
ALLOW_QA_DATA_WRITE=true npm run qa:data:seed
ALLOW_QA_DATA_WRITE=true npm run qa:data:cleanup
```

The seed script only creates users with the safe prefix
`qa+ppam-...@example.invalid`. Cleanup only deletes users matching that prefix.
Do not use these scripts for real volunteers.

## 8. Release command checklist

Before promoting a deployment:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

For local E2E against Docker Postgres on `5433`, run the seed and E2E commands
with explicit database URLs as documented in `docs/qa-e2e.md`.
