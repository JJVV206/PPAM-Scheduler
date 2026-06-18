# Deployment Checklist

Use this checklist for every release candidate before merging or promoting a
Vercel deployment.

## Local Gate

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

When testing against the Docker database on port `5433`, seed the E2E fixtures
first:

```bash
ALLOW_E2E_DATA_WRITE=true \
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
npm run e2e:data:seed

DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
npm run test:e2e
```

Mailpit must be available at `http://localhost:8025` for the email E2E test.

## Vercel And Neon

- Production deploy target is selected.
- `DATABASE_URL` uses the Neon pooled URL.
- `DIRECT_URL` uses the Neon direct URL.
- `NEXTAUTH_URL` matches the final production domain.
- `NEXTAUTH_SECRET` and `CRON_SECRET` are strong random values.
- Resend domain is verified before sending real volunteer emails.
- `RESEND_FROM` uses the verified sender domain.
- Custom domain aliases point to the current healthy deployment.

## After Deploy

Run read-only smoke QA:

```bash
QA_BASE_URL="https://YOUR_PRODUCTION_URL" \
QA_ADMIN_EMAIL="admin@example.com" \
QA_ADMIN_PASSWORD="admin-password" \
npm run qa:smoke
```

Verify manually:

- admin login
- `/admin`
- `/admin/schedule`
- `/admin/assignments`
- `/admin/assignments/[id]`
- controlled production email to one test volunteer
- `/confirm-assignment/[token]`
- volunteer login
- `/volunteer`
- `/volunteer/assignments`
- `/volunteer/availability`
- `/volunteer/profile`

## Rollback

- Promote the previous healthy Vercel deployment.
- Re-run `npm run qa:smoke` against the rollback target.
- Review whether any migration requires a forward fix before changing database
  state.
