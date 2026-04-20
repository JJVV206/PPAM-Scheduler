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

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Run Prisma migrations or `prisma db push`.
4. Seed the database with `npm run db:seed`.
5. Start the app with `npm run dev`.

## Demo Users

Seeded users are created by `prisma/seed.ts`.

- Admin: `admin@ppam.local` / `Admin123!`
- Volunteer: `julia@ppam.local` / `Volunteer123!`
