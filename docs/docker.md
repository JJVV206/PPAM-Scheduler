# Docker

This project ships with a full local Docker stack:

- Next.js app
- PostgreSQL
- Mailpit SMTP inbox
- Prisma migration runner

## Local Development

Start the full stack:

```bash
npm run docker:dev
```

If local port `5432` is already in use, run:

```bash
POSTGRES_HOST_PORT=5433 npm run docker:dev
```

If local port `3000` is already in use too, run:

```bash
APP_PORT=3002 NEXTAUTH_URL=http://localhost:3002 POSTGRES_HOST_PORT=5433 npm run docker:dev
```

The app runs at:

```txt
http://localhost:3000, or the APP_PORT value when overridden
```

Mailpit runs at:

```txt
http://localhost:8025
```

PostgreSQL is exposed for local tools like DBeaver:

```txt
Host: localhost
Port: 5432, or 5433 when POSTGRES_HOST_PORT=5433 is used
Database: ppam_scheduler
Username: postgres
Password: postgres
SSL: disabled
```

The `migrate` service runs `prisma migrate deploy` before the app starts.

## Seed Demo Data

Seed only when you want to reset local demo data:

```bash
npm run docker:seed
```

The seed script deletes existing local data before recreating demo users and assignments.

Demo credentials:

```txt
Admin: admin@ppam.local / Admin123!
Volunteer: julia@ppam.local / Volunteer123!
```

## Stop Or Reset

Stop containers while keeping data:

```bash
npm run docker:down
```

Delete containers and volumes:

```bash
npm run docker:reset
```

## Production Image

Build the standalone production image:

```bash
docker build -t ppam-scheduler .
```

Run it with production environment variables:

```bash
docker run --rm -p 3000:3000 --env-file .env.production ppam-scheduler
```

Required production variables:

```txt
DATABASE_URL
DIRECT_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_FROM
SMTP_USER / SMTP_PASS when your provider requires auth
```

Run migrations from a tools image before starting production:

```bash
docker build --target dev -t ppam-scheduler-tools .
docker run --rm --env-file .env.production ppam-scheduler-tools npm run db:migrate:deploy
```

Create the first production admin from the same tools image:

```bash
docker run --rm --env-file .env.production \
  -e ADMIN_EMAIL="admin@example.com" \
  -e ADMIN_PASSWORD="replace-with-a-strong-password" \
  ppam-scheduler-tools npm run prod:create-admin
```
