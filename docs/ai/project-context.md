# Forumo project context

This file preserves detailed project facts and operational notes from the former root `CLAUDE.md`. It is informational, may become stale, and is not an approval record or policy. `AGENTS.md` and applicable `.assistant/rules/` take precedence.

## Project Overview

Forumo is a peer-to-peer marketplace and auction platform built for emerging markets, with a focus on Africa. Buyers and sellers transact through escrow-protected payments. Core features: listing creation and moderation, fixed-price and timed auctions, buyer offers, KYC identity verification, real-time messaging, shipping integration (Shippo), Stripe Connect seller payouts, and GDPR-compliant account management.

Payment providers: **Stripe** (global, Connect payouts) and **Paystack** (NGN/GHS/KES/ZAR). Currency selection is automatic per `PaymentProviderFactory.selectProvider(currency)`.

## Monorepo structure

```
forumo2/
├── apps/
│   ├── backend/          # NestJS REST API + WebSocket server (port 4000) — PRODUCTION READY
│   ├── web/              # Next.js 15 buyer/seller frontend (port 3000) — IN PROGRESS (typecheck clean)
│   ├── admin/            # Next.js 15 internal admin dashboard (port 3001) — IN PROGRESS (auth + 6 pages wired, typecheck clean)
│   ├── mobile/           # Expo 50 React Native app — IN PROGRESS (27 screens implemented & navigation-wired; direct apiClient calls, no tests, unverified end-to-end)
│   └── moderation-service/  # FastAPI Python microservice (port 5005) — PRODUCTION READY
├── packages/
│   ├── shared/           # Zod schemas + ForumoApiClient — PRODUCTION READY
│   ├── design-system/    # Shared React UI components (4 components) — IN PROGRESS
│   └── config/           # Shared config re-exports — PRODUCTION READY
├── docker-compose.yml    # Local dev stack (Postgres, Redis, MinIO, Mailpit, moderation-service)
├── turbo.json            # Turbo task graph
└── pnpm-workspace.yaml   # Workspace declaration
```

## Tech stack

### Per app/package

| App / Package             | Language       | Framework                   | Key Libraries                                                                                                                           | ORM / DB               |
| ------------------------- | -------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `apps/backend`            | TypeScript 5.4 | NestJS 10                   | Prisma 5.20, BullMQ 5, Socket.IO 4.8, Stripe SDK 20, Shippo 2.18, Pino 9, nestjs-zod 5                                                  | Prisma → PostgreSQL 16 |
| `apps/web`                | TypeScript 5.4 | Next.js 15 (App Router)     | NextAuth 4.24, TanStack Query 5.51, TailwindCSS 4.1, Stripe.js 5, Framer Motion 12, React Hook Form 7, Recharts 3, Socket.IO client 4.8 | — (API-only)           |
| `apps/admin`              | TypeScript 5.4 | Next.js 15 (App Router)     | NextAuth 4.24, TanStack Query 5.51, TailwindCSS 4.1                                                                                     | — (API-only)           |
| `apps/mobile`             | TypeScript     | Expo 50 / React Native 0.73 | React Navigation 7, expo-notifications, @forumo/shared                                                                                  | — (API-only)           |
| `apps/moderation-service` | Python 3       | FastAPI 0.115               | Uvicorn 0.30, Pydantic, OpenTelemetry 1.27                                                                                              | — (stateless)          |
| `packages/shared`         | TypeScript 5.4 | —                           | Zod 3.23                                                                                                                                | —                      |
| `packages/design-system`  | TypeScript 5.4 | React 18 (peer)             | clsx 2, tailwind-merge 3                                                                                                                | —                      |

### Shared infrastructure

| Layer           | Technology            |
| --------------- | --------------------- |
| Package manager | pnpm 11.19.0          |
| Task runner     | Turbo 2.x             |
| Node version    | 22.23.2               |
| Database        | PostgreSQL 16         |
| Cache / queues  | Redis 7               |
| Object storage  | MinIO (S3-compatible) |
| Email preview   | Mailpit               |

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

## Coding conventions

- **TypeScript strict mode is on** — no implicit `any`. All new code must be fully typed.
- **NestJS modules follow feature-folder structure**: `feature.module.ts`, `feature.controller.ts`, `feature.service.ts`, plus `dto/`, `entities/`, `processors/` subdirs as needed.
- **Prisma schema is the single source of truth** for all data shapes. Do not define domain types separately from the schema — derive DTOs from it via Zod (`nestjs-zod`).
- **All request/response types use Zod schemas** via `nestjs-zod`. DTO classes extend `createZodDto(schema)`. Never use plain `class-validator` decorators.
- **All API responses follow the standard envelope**: `{ data, meta, error }`. Errors are normalised by `AllExceptionsFilter`.
- **All webhook handlers must verify signatures before processing**:
  - Stripe: `Stripe-Signature` header + raw body buffer (Stripe SDK `constructEvent`).
  - Paystack: `X-Paystack-Signature` header with HMAC-SHA512 of the raw body using the Paystack secret key. Fully implemented in `payments.controller.ts` using `createHmac('sha512')` and `timingSafeEqual`.
  - Shippo: `Shippo-Signature` header.
- **Never store raw card data** — all card handling goes through Stripe.js or Paystack.js on the client; the backend never sees raw PAN data.
- **Roles**: `BUYER | SELLER | ADMIN | MODERATOR`. Use `@Roles(UserRole.X)` + `RolesGuard`. Never hard-code role strings.
- **Prisma is injected via `PrismaService`** (singleton in root module). Never import `@prisma/client` directly in feature services.
- **Structured logging via `pino`** — always use `this.logger = new Logger(ClassName.name)`.
- **Frontend data fetching goes through `ForumoApiClient`** — never call `fetch()` directly to the backend from web/admin/mobile.
- **All new hooks** go in `apps/web/src/lib/react-query/hooks.ts`; query keys in `query-keys.ts`.
- **Dynamic Next.js route `href` values must be cast** `as any` — e.g. `href={"/app/orders/" + id as any}`.

## Current gaps

As of last update (2026-05-29):

| Gap                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Account suspension enforcement**~~       | RESOLVED — enforced via `assertAccountActive()` inside `JwtStrategy.validate()` (not a guard). Blocks SUSPENDED/BANNED on every authenticated route. See `apps/backend/CLAUDE.md` "Guard and interceptor chain".                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ~~**Authenticated-only review submission**~~ | RESOLVED — `POST/PATCH/DELETE /reviews` now require `JwtAuthGuard`. `reviewerId` is taken from the token (never the body); `update`/`remove` enforce author-or-ADMIN/MODERATOR; party-to-order check (`checkPurchaseEligibility`) was already present.                                                                                                                                                                                                                                                                                                                                                                                              |
| ~~**Seller payout flow (ZAR)**~~             | RESOLVED — ZAR is actually charged via Paystack, not Stripe (`PaymentProviderFactory` routes NGN/GHS/KES/ZAR to Paystack). Fixed two bugs: `createTransferRecipient` (`paystack.service.ts`) hardcoded Paystack recipient `type: 'nuban'` for every currency — now maps ZAR to `'basa'` (Nigeria keeps `'nuban'`; GHS/KES still unverified, left as-is). `schedulePayouts()` (`payouts.service.ts`) created PENDING `Payout` rows but nothing ever called `processPayout()` on them — added a second cron (`processPendingPayouts`, 4am) to actually process them. Non-ZAR Stripe Connect payout path is untouched and still unverified end-to-end. |
| ~~**Revenue admin dashboard**~~              | RESOLVED — `apps/admin/src/app/admin/analytics/page.tsx` is built and wired into the sidebar nav, consuming `GET /admin/dashboard/analytics`. The 6 built admin pages are users, kyc, listings, moderation, disputes, analytics — there is no dedicated `/admin` overview page (`/admin` redirects to `/admin/users`).                                                                                                                                                                                                                                                                                                                              |
| ~~**Frontend — escrow dispute UI**~~         | RESOLVED — buyer-facing board + detail at `apps/web/src/app/(authenticated)/app/disputes/` (`page.tsx`, `disputes-board.tsx`, `[id]/dispute-detail.tsx`, `error.tsx`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ~~**Frontend — cart variant integration**~~  | RESOLVED — variants flow end-to-end: selector in `listing-detail.tsx` → `cart-context.tsx` (keyed by `listingId:variantId`) → `checkout-flow.tsx` → `createOrderItemSchema` → `orders.service.ts` → `OrderItem`/`CartItem` in the Prisma schema.                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Mobile app**                               | 27 screens implemented and navigation-wired (auth, listings, cart, checkout, KYC, orders, offers, messaging, reviews, storefront, seller dashboard). Caveats: data fetching is direct `useAuth().apiClient` calls (no React Query), no test suite, not verified end-to-end against a live backend.                                                                                                                                                                                                                                                                                                                                                  |

## Historical operational notes

- **Always read `apps/backend/prisma/schema.prisma`** before generating new models, DTOs, or database queries. The schema is the ground truth; do not infer field names from TypeScript types or old code.
- **Do not create a new NestJS module** without first checking `src/modules/` — there are 27 existing modules. Extend an existing one if the feature fits.
- **When adding a new API endpoint**, update the corresponding `@ApiOperation`, `@ApiResponse`, and `@ApiBearerAuth` Swagger decorators on the controller method. Swagger UI is at `/docs`.
- **Write tests for any new service method.** Unit tests go in `*.spec.ts` alongside the file; integration tests in `test/`.
- **Do not modify the escrow state machine** (`src/modules/escrow/`) or **auction state machine** (`src/modules/auctions/`) without explicit instruction — ask first. These touch payment and fund-release logic.
- **When adding a Paystack or Stripe webhook route**, implement signature verification before any business logic. Reject without processing if verification fails.
- **Run `npx prisma generate --schema prisma/schema.prisma`** inside `apps/backend` after any schema change, even without a live database, so TypeScript types stay in sync.
- **After changing `packages/shared/src/types.ts` or `api-client.ts`**, run `pnpm typecheck` from the root — both `apps/web` and `apps/backend` consume these types and will break if out of sync.
- **Do not start a dev server or run preview verification tools** after editing code in this repo. End the turn after edits are complete.
