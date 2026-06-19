# Backend

NestJS 10 REST API and WebSocket server for Forumo. Handles auth, listings, orders, escrow, payments, auctions, messaging, KYC, moderation, notifications, and shipping. Exposes `api/v1/` prefix; Swagger UI at `/docs` (non-production only).

## Tech stack

| | Version |
|---|---|
| NestJS | 10.4.x |
| Prisma | 5.20.x |
| PostgreSQL | 16 |
| Redis / BullMQ | ioredis 5.x / bullmq 5.x |
| TypeScript | 5.4.x |
| Stripe SDK | 20.x |
| Shippo | 2.18.x |
| Pino | 9.x |
| Socket.IO | 4.8.x |
| nestjs-zod | 5.x |

## Run locally

```bash
# From apps/backend
pnpm dev

# Or from repo root
pnpm dev:backend
```

Requires PostgreSQL, Redis, and MinIO to be running (`pnpm docker:up` from root).

## Database

```bash
# Generate Prisma client (always do this after schema changes, even without a DB)
npx prisma generate --schema prisma/schema.prisma

# Apply migrations to a running database
npx prisma migrate deploy --schema prisma/schema.prisma

# Interactive migration creation (development only)
npx prisma migrate dev --schema prisma/schema.prisma

# Seed database
npx ts-node --transpile-only prisma/seed.ts

# Open Prisma Studio
npx prisma studio --schema prisma/schema.prisma
```

Schema is at `prisma/schema.prisma`. Migrations are in `prisma/migrations/`.

## Key environment variables

```
DATABASE_URL
JWT_SECRET
JWT_TTL
REDIS_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CONNECT_WEBHOOK_SECRET
MAILGUN_API_KEY
MAILGUN_DOMAIN
MAILGUN_EMAIL_FROM
SNS_REGION
SNS_ACCESS_KEY_ID
SNS_SECRET_ACCESS_KEY
MINIO_ENDPOINT
MINIO_PORT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
UPLOADS_BUCKET
SHIPPO_API_KEY
SHIPPO_WEBHOOK_SECRET
MODERATION_SERVICE_URL
TOS_VERSION
FRONTEND_URL
NODE_ENV
PORT
ALLOWED_ORIGINS
```

Only `DATABASE_URL` and `JWT_SECRET` are hard-required at startup; everything else fails gracefully or disables the relevant feature.

## Module structure

All modules live under `src/modules/`. There are 27 of them:

```
app.module.ts          # Root module — imports all feature modules
auth/                  # JWT login, OTP, Google OAuth, password reset
users/                 # User CRUD, profile, avatar
listings/              # Listing CRUD, search, image upload, reporting
orders/                # Order lifecycle, status transitions, payments
escrow/                # Escrow hold/release/refund logic
messaging/             # Socket.IO real-time chat threads
reviews/               # Buyer/seller reviews
auctions/              # Timed auctions, bids, auto-award via cron
offers/                # Buyer offers on fixed-price listings
cart/                  # Shopping cart
wishlist/              # Saved listings
storefronts/           # Seller storefront + collections
inventory/             # Stock management
shipping/              # Shippo label creation, tracking webhooks
returns/               # Return requests, auto-release escrow
payouts/               # Stripe Connect seller payouts
fees/                  # Fee schedules, fee preview
kyc/                   # Identity verification pipeline
admin/                 # Admin-only endpoints (disputes, KYC, moderation)
notifications/         # EMAIL/SMS/PUSH/IN_APP delivery via Mailgun + SNS
analytics/             # Seller analytics
legal/                 # TOS acceptance, account deletion (GDPR), data export
storage/               # MinIO file upload abstraction
health/                # /healthz liveness endpoint
observability/         # Prometheus metrics endpoint
```

## Guard and interceptor chain

**Auth/role guards are applied per-controller**, not globally — controllers declare `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` themselves. The only globally-registered `APP_GUARD` in `app.module.ts` is `ThrottlerGuard` (rate limiting).

1. `JwtAuthGuard` (passport-jwt) — verifies Bearer token; delegates to `JwtStrategy.validate()`.
2. `RolesGuard` (`src/common/guards/roles.guard.ts`) — enforces the `@Roles()` decorator.

**Account-status enforcement is NOT a guard.** It runs inside `JwtStrategy.validate()` (`src/modules/auth/strategies/jwt.strategy.ts`), which calls `assertAccountActive(user, req)` from `src/common/guards/account-status.guard.ts` after token verification. Because every authenticated route passes through the JWT strategy, this blocks `SUSPENDED`/`BANNED` users platform-wide and gates `PENDING_VERIFICATION` users to an allowlist (`/api/v1/kyc/*`, `GET /api/v1/auth/*`, `POST /api/v1/auth/logout`). `account-status.guard.ts` exports helper functions, not a `CanActivate` class.

Global interceptors:
- `HttpMetricsInterceptor` — records request count and latency to Prometheus
- `TosInterceptor` (`src/common/interceptors/tos.interceptor.ts`) — checks `req.user.termsAcceptedAt` + `tosVersion` against `TOS_VERSION` env var; returns 403 if stale. Use `@SkipTosCheck()` to exempt a route. Auth controller is fully exempted.

Global filters:
- `AllExceptionsFilter` — normalises all thrown exceptions to a consistent JSON error shape.

## Payment integration

`src/modules/orders/payment-provider.factory.ts` — `PaymentProviderFactory.selectProvider(currency)` returns `'paystack'` for NGN/GHS/KES/ZAR, `'stripe'` for everything else.

- **Stripe**: `payments.service.ts` — creates PaymentIntents, validates Stripe webhook HMAC. Stripe Connect used for seller payouts (`PayoutsModule`).
- **Paystack**: `paystack.service.ts` — initialises transactions and verifies them. Webhook HMAC fully implemented in `payments.controller.ts` using `createHmac('sha512')` and `timingSafeEqual`.

## Background jobs

`@nestjs/schedule` (not BullMQ processors) is used for cron:

- `auctions/processors/auction-end.processor.ts` — runs every minute (`@Cron('* * * * *')`), finds ended auctions with no winner order yet, creates an Order for the highest bidder, sends notifications.
- `legal/account-deletion.service.ts` — runs hourly, soft-deletes accounts scheduled for deletion: anonymises PII (SHA256 email hash), cancels open listings and orders.

BullMQ (`bullmq`, `ioredis`) is installed but not actively used for queued jobs — Redis is used for session caching and OTP rate limiting.

## Known bugs (do not introduce workarounds)

- `src/modules/inventory/inventory.service.ts`: Prisma Json type errors. Pre-existing.
- `src/modules/audit-log/audit-log.service.ts`: Prisma Json type error. Pre-existing.
- OTel tracing bootstrap is commented out in `src/main.ts` due to SDK version conflicts. Do not uncomment without resolving version compatibility first.

## TypeScript status

`tsc --noEmit` is clean (zero errors). The following non-obvious fixes keep it that way:
- `listing.serializer.ts` `SafeListing.status` is typed as `'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'SUSPENDED'` — must match `listingStatusSchema` in `@forumo/shared`.
- `throttler-redis.storage.ts` defines `ThrottlerStorageRecord` locally (not from `@nestjs/throttler`) and uses `err.msBeforeNext` (not `msBlockBeforeNext`).
- `payments.controller.ts` casts `event.type as string` for `transfer.paid` / `transfer.failed` events which are absent from the Stripe SDK TypeScript union.
- `tax.service.ts` uses `as any` for `pi.automatic_tax` and `tax_breakdown[0].jurisdiction` which are absent from Stripe SDK types.
- `orders.service.ts` rebinds narrowed status to `const currentOrderStatus: string` before comparing against `OrderStatus.FULFILLED`.

## Conventions

- All request/response types use **Zod schemas** via `nestjs-zod`. DTO classes extend `createZodDto(schema)`. Never use plain `class-validator` decorators.
- All endpoints are prefixed `api/v1/`.
- Module directory layout: `feature.module.ts`, `feature.controller.ts`, `feature.service.ts`, plus `dto/`, `entities/`, `processors/` subdirs as needed.
- Roles: `BUYER | SELLER | ADMIN | MODERATOR`. Use `@Roles(UserRole.ADMIN)` + `RolesGuard`.
- Prisma is injected via `PrismaService` (a singleton in the root module). Never import `@prisma/client` directly in feature services.
- Structured logging via `pino` — always log with `this.logger = new Logger(ClassName.name)`.
- Avoid throwing raw `Error`; use NestJS `HttpException` or its subclasses (`BadRequestException`, `NotFoundException`, etc.).
