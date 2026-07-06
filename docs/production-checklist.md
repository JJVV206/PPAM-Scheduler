# Production Checklist

Use this checklist before promoting a build to real PPAM production traffic.

## Predeploy

- Confirm Neon production branch is selected.
- Confirm `DATABASE_URL` uses the pooled Neon URL.
- Confirm `DIRECT_URL` uses the direct Neon URL.
- Confirm `NEXTAUTH_SECRET` is a strong random value.
- Confirm `NEXTAUTH_URL` matches the final Vercel/custom domain.
- Confirm `CRON_SECRET` is a strong random value.
- Confirm `RESEND_API_KEY` and `RESEND_FROM` are configured when email readiness is required.
- Confirm the Resend sender domain is verified before sending to real volunteers.
- Confirm `RESEND_FROM` uses a verified domain email, not `onboarding@resend.dev`, before production traffic.
- Confirm SMTP variables only if using SMTP instead of Resend API.
- Confirm Vercel domain aliases point to the intended production deployment.
- Confirm the Neon production branch is not the local/dev branch.
- Run:

```bash
npm run typecheck
npm run lint
npm run ready:prod
npm run test:e2e:critical
E2E_BASE_URL="https://YOUR_PRODUCTION_URL" npm run test:e2e:prod
npm audit --omit=dev
```

For local E2E with the Docker database mapped to port `5433`, use:

```bash
ALLOW_E2E_DATA_WRITE=true \
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
npm run e2e:data:seed

DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/ppam_scheduler?schema=public" \
npm run test:e2e
```

## Database

- Apply migrations with:

```bash
npm run prod:migrate
```

- Do not run `prisma db push` against production.
- Do not run demo seed scripts against production.
- Do not run E2E or QA write seeds against production.

## Deploy

- Deploy with Vercel production target.
- Confirm the production alias points to the latest deployment.
- Verify the core health endpoint:

```bash
curl -i https://YOUR_PRODUCTION_URL/api/health
```

- Verify full readiness when email delivery is expected:

```bash
curl -i "https://YOUR_PRODUCTION_URL/api/health?scope=readiness"
```

- Verify the automation cron rejects unauthenticated requests:

```bash
curl -i https://YOUR_PRODUCTION_URL/api/cron/assignment-automation
```

- Verify the automation cron accepts the configured secret and returns only a
  short operational summary:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_PRODUCTION_URL/api/cron/assignment-automation
```

## Smoke QA

Run read-only QA:

```bash
QA_BASE_URL="https://YOUR_PRODUCTION_URL" \
QA_ADMIN_EMAIL="admin@example.com" \
QA_ADMIN_PASSWORD="admin-password" \
npm run qa:smoke
```

The smoke test covers:

- core health
- unauthenticated login page
- protected-route redirect
- admin login
- admin dashboard API
- settings API
- points API
- volunteers API
- schedule week API
- admin role isolation from volunteer API

It does not create volunteers, assignments, invitations, or emails.

## Controlled QA Data

Only run write QA with explicit confirmation:

```bash
ALLOW_QA_DATA_WRITE=true npm run qa:data:seed
ALLOW_QA_DATA_WRITE=true npm run qa:data:cleanup
```

Cleanup only removes users matching `qa+ppam-...@example.invalid`.

## Manual Release Checks

After deploy, verify these pages with the production admin account:

- `/admin`
- `/admin/schedule`
- `/admin/assignments`
- `/admin/assignments/[id]`
- `/admin/replacements`
- `/admin/attention`
- `/admin/volunteers`
- `/admin/settings`

Then verify a volunteer account can access:

- `/volunteer`
- `/volunteer/assignments`
- `/volunteer/availability`
- `/volunteer/profile`

For email readiness, send one controlled assignment invitation to a test
volunteer using the production sender domain and confirm delivery in the
recipient inbox. Do not use a real weekly rollout as the first email test.

## Rollback

- Promote the previous healthy Vercel deployment.
- If the failed deploy included migrations, verify whether a data rollback or
  forward fix is safer before changing database state.
- Re-run `npm run qa:smoke` after rollback.
