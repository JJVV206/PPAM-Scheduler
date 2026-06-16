# Production Checklist

Use this checklist before promoting a build to real PPAM production traffic.

## Predeploy

- Confirm Neon production branch is selected.
- Confirm `DATABASE_URL` uses the pooled Neon URL.
- Confirm `DIRECT_URL` uses the direct Neon URL.
- Confirm `NEXTAUTH_SECRET` is a strong random value.
- Confirm `NEXTAUTH_URL` matches the final Vercel/custom domain.
- Confirm `CRON_SECRET` is a strong random value.
- Confirm SMTP variables are configured when email readiness is required.
- Run:

```bash
npm run ready:prod
npm audit --omit=dev
```

## Database

- Apply migrations with:

```bash
npm run prod:migrate
```

- Do not run `prisma db push` against production.
- Do not run demo seed scripts against production.

## Deploy

- Deploy with Vercel production target.
- Confirm the production alias points to the latest deployment.
- Verify the core health endpoint:

```bash
curl -i https://YOUR_PRODUCTION_URL/api/health
```

- Verify full readiness when SMTP is expected:

```bash
curl -i "https://YOUR_PRODUCTION_URL/api/health?scope=readiness"
```

- Verify the automation cron rejects unauthenticated requests:

```bash
curl -i https://YOUR_PRODUCTION_URL/api/cron/assignment-automation
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

## Controlled QA Data

Only run write QA with explicit confirmation:

```bash
ALLOW_QA_DATA_WRITE=true npm run qa:data:seed
ALLOW_QA_DATA_WRITE=true npm run qa:data:cleanup
```

Cleanup only removes users matching `qa+ppam-...@example.invalid`.

## Rollback

- Promote the previous healthy Vercel deployment.
- If the failed deploy included migrations, verify whether a data rollback or
  forward fix is safer before changing database state.
- Re-run `npm run qa:smoke` after rollback.
