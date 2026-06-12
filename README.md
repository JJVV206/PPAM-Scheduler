# PPAM Scheduler

Production-ready MVP for managing weekly public preaching assignments with role-based admin and volunteer experiences.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS + shadcn/ui-style components
- Prisma + PostgreSQL
- NextAuth credentials authentication
- TanStack Query
- React Hook Form + Zod

## Getting Started

### With Docker

1. Start the full stack with `npm run docker:dev`.
2. Seed demo data with `npm run docker:seed` if you want the default local users.
3. Open `http://localhost:3000`.
4. Inspect local emails at `http://localhost:8025`.

Docker details are documented in `docs/docker.md`.

If local ports are already in use, start Docker with `APP_PORT=3002 NEXTAUTH_URL=http://localhost:3002 POSTGRES_HOST_PORT=5433 npm run docker:dev`.

### Without Docker

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start PostgreSQL with `npm run db:start`.
4. Sync the schema with `npm run db:push`.
5. Seed the database with `npm run db:seed`.
6. Start the app with `npm run dev`.

## Local Database

This repo includes a local PostgreSQL service in `compose.yaml`.

- Start DB: `npm run db:start`
- Start full Docker app stack: `npm run docker:dev`
- Check DB status: `npm run db:status`
- Stop DB: `npm run db:stop`
- First-time setup: `npm run db:prepare`
- Seed Docker demo data: `npm run docker:seed`

If `docker compose` cannot connect, Docker Desktop is not running yet. Start Docker Desktop first, then rerun `npm run db:start`.

If `db:start` reports that `ppam-scheduler-postgres` already exists, the script now reuses that container instead of trying to recreate it. This makes the local flow idempotent when the database was created in an earlier session.

If you see `Can't reach database server at localhost:5432`, the app is up but PostgreSQL is not running.

## Demo Users

Seeded users are created by `prisma/seed.ts`.

- Admin: `admin@ppam.local` / `Admin123!`
- Volunteer: `julia@ppam.local` / `Volunteer123!`

## Production Readiness

Before deploying, configure these environment variables with real production values:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER` and `SMTP_PASS` when your provider requires auth
- `SMTP_FROM`

Recommended release flow:

1. Run `npm run ready:prod`
2. Apply schema changes with `npm run db:migrate:deploy`
3. Create the first production admin with `npm run prod:create-admin`
4. Start the app with `npm run start` or deploy to Vercel
5. Verify `GET /api/health` returns `200 OK`
6. Verify full readiness with `GET /api/health?scope=readiness`
7. Run `npm run qa:smoke` against the deployed URL

Notes:

- Production no longer relies on `prisma db push`; use migrations instead.
- `/api/health` reports core app/database health. Use `?scope=readiness` when email must be part of the release gate.
- If SMTP is missing or invalid in production, password reset and assignment emails will fail explicitly instead of being marked as sent.
- The app is configured with `output: "standalone"` to support container deployment.
- Vercel + Neon deployment steps are documented in `docs/deploy-vercel.md`.
- The production checklist is documented in `docs/production-checklist.md`.
