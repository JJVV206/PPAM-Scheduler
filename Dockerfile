FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev:docker"]

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ppam_scheduler?schema=public" \
  DIRECT_URL="postgresql://postgres:postgres@localhost:5432/ppam_scheduler?schema=public" \
  NEXTAUTH_SECRET="ppam-scheduler-docker-build-placeholder-secret" \
  NEXTAUTH_URL="https://ppam.local" \
  SMTP_HOST="localhost" \
  SMTP_PORT="1025" \
  SMTP_SECURE="false" \
  SMTP_FROM="PPAM Scheduler <no-reply@ppam.local>" \
  npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
