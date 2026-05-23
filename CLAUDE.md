# Forumo — Root

Forumo is a peer-to-peer marketplace for physical goods. Buyers and sellers transact through escrow-protected payments, with listing moderation, KYC verification, auctions, and real-time messaging. This is the monorepo root.

## Monorepo structure

```
forumo2/
├── apps/
│   ├── backend/          # NestJS REST API + WebSocket server (port 4000)
│   ├── web/              # Next.js 15 buyer/seller frontend (port 3000)
│   ├── admin/            # Next.js 15 internal admin dashboard (port 3001)
│   ├── mobile/           # Expo 50 React Native app (pre-alpha)
│   └── moderation-service/  # FastAPI Python microservice (port 5005)
├── packages/
│   ├── shared/           # Zod schemas + ForumoApiClient (used by web, mobile, admin)
│   ├── design-system/    # Shared React UI components
│   └── config/           # Shared config re-exports
├── docker-compose.yml    # Local dev stack (Postgres, Redis, MinIO, Mailpit, moderation-service)
├── turbo.json            # Turbo task graph
└── pnpm-workspace.yaml   # Workspace declaration
```

## Tech stack

| Layer | Technology |
|---|---|
| Package manager | pnpm 9.1.4 |
| Task runner | Turbo 2.x |
| Node version | 20+ |
| Database | PostgreSQL 16 |
| Cache / queues | Redis 7 |
| Object storage | MinIO (S3-compatible) |
| Email preview | Mailpit |

## Environment setup (run in order)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env — minimum required: DATABASE_URL, JWT_SECRET, NEXTAUTH_SECRET

# 3. Start infrastructure services
pnpm docker:up

# 4. Run database migrations and seed data
pnpm db:setup

# 5. Start all apps in parallel
pnpm dev
```

## Running individual apps

```bash
pnpm dev:backend      # Backend only
pnpm dev:web          # Web frontend only
pnpm dev:admin        # Admin dashboard only
pnpm dev:mobile       # Mobile (Expo) only
```

## Other common commands

```bash
pnpm build            # Build all packages and apps
pnpm test             # Run all unit tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm lint             # ESLint across all packages
pnpm typecheck        # TypeScript check across all packages
pnpm format           # Prettier format
pnpm db:studio        # Open Prisma Studio
pnpm docker:down      # Stop infrastructure
pnpm docker:clean     # Stop infrastructure and wipe volumes
```

## Key environment variables

Backend: `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MAILGUN_API_KEY`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MODERATION_SERVICE_URL`, `TOS_VERSION`, `FRONTEND_URL`

Web: `NEXT_PUBLIC_API_BASE_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_USE_API_MOCKS` (dev only)

## CI pipeline

`.github/workflows/ci.yml` runs on every push and PR:
1. **Lint** — ESLint, Prettier, TypeScript typecheck
2. **Test** — Jest matrix across backend/web/mobile/shared with Postgres + Redis service containers
3. **E2E** — Playwright tests against `docker-compose.test.yml`
4. **Build** — Turbo build for all packages
5. **Security** — npm audit, Trivy container scan, GitGuardian secrets scan

## Shared packages

`@forumo/shared` — import `ForumoApiClient` and all Zod types from here. Both web and mobile use this.  
`@forumo/design-system` — shared React components (Button, Card, DataTable, FilterBar).  
`@forumo/config` — thin re-export of shared config utilities.

## TypeScript health

`pnpm typecheck` passes clean across `apps/backend`, `apps/web`, and `packages/shared`. Before opening a PR, run:
```bash
pnpm --filter backend exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter @forumo/shared exec tsc --noEmit
```

## Sharp edges

- Telemetry (`startTracing`) is commented out in `src/main.ts` due to version compatibility issues. Don't uncomment without testing.
- `pnpm docker:clean` wipes all volumes including the database. Do not run if you have local data you need.
- `NEXT_PUBLIC_USE_API_MOCKS=true` enables mock auth in development. It must never be set in production builds.
- The moderation service is included in `docker-compose.yml` and starts automatically with `pnpm docker:up`.
- Run `prisma generate` inside `apps/backend` any time you change `schema.prisma`, even without a live database.
