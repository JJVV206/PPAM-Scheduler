# Local Cache Recovery

Use this workflow when local navigation feels frozen, Next.js reports missing
files under `.next/server`, or a stale build artifact survives after switching
branches.

## Standard Recovery

```bash
npm run clean:next
npm run dev
```

`clean:next` removes only the project-local `.next` directory. It does not touch
`node_modules`, the database, Mailpit, uploaded files, or Docker volumes.

On macOS, the OS can deny removing the empty `.next` directory because of
system attributes. In that case the script still removes the cache contents and
reports that the empty directory was kept. That is a successful recovery state.

For a one-step fresh dev start:

```bash
npm run dev:fresh
```

You can verify the clean server path with:

```bash
npm run typecheck
```

For a browser-level check after recovery, reseed E2E data and run the focused
admin smoke or the full suite from `docs/qa-e2e.md`.

## Docker Behavior

Docker keeps the app cache isolated from the host cache:

```yaml
volumes:
  - ppam_scheduler_next:/app/.next
```

That means:

- `npm run clean:next` cleans the host `.next` cache.
- Docker dev uses its own named volume for `/app/.next`.
- If the Docker cache becomes stale, restart the stack first:

```bash
npm run docker:down
npm run docker:dev
```

Only use `npm run docker:reset` when you intentionally want to delete Docker
database volumes and rebuild local data from seed.

## When To Use

- After changing branches with large Next.js server component changes.
- After seeing `ENOENT` errors under `.next/server`.
- After dependency upgrades that affect Next.js, React, Prisma, or bundling.
- Before reporting a local-only build issue that does not reproduce in CI.
