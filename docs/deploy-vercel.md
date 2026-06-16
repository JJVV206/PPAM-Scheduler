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

Add these variables in Vercel Project Settings -> Environment Variables for Production:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CRON_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Generate `NEXTAUTH_SECRET` with:

```bash
openssl rand -base64 32
```

Generate `CRON_SECRET` the same way. Vercel will call `/api/cron/assignment-automation`
every 30 minutes and must send `Authorization: Bearer $CRON_SECRET`.
The cron response intentionally exposes only an operational summary, not step
details, email metadata, tokens, or internal error messages.

Set `NEXTAUTH_URL` to the final production URL, for example:

```text
https://ppam-scheduler.vercel.app
```

## 3. Apply migrations

Run migrations against Neon before the first production deploy and whenever schema changes are released:

```bash
DATABASE_URL="PASTE_NEON_POOLED_URL" DIRECT_URL="PASTE_NEON_DIRECT_URL" npm run prod:migrate
```

Do not run `npm run db:push` or `npm run db:seed` against production.

## 4. Deploy

Vercel uses `npm run vercel:build`, which runs:

```bash
prisma generate && next build
```

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

That endpoint should return `200` only when SMTP is configured correctly.

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

## 7. Controlled QA data

QA write scripts are disabled unless you explicitly opt in:

```bash
ALLOW_QA_DATA_WRITE=true npm run qa:data:seed
ALLOW_QA_DATA_WRITE=true npm run qa:data:cleanup
```

The seed script only creates users with the safe prefix
`qa+ppam-...@example.invalid`. Cleanup only deletes users matching that prefix.
Do not use these scripts for real volunteers.
