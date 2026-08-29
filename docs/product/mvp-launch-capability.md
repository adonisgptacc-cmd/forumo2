# MVP Launch Capability — Forumo Web-First

**Date:** 2026-08-16
**Source:** MVP blockers list (founder note, 10:41)
**Status:** Draft — awaiting owner decisions on Commerce Safety
**Decision 2026-08-29 (ABADO approved):** Google OAuth removed for MVP. Auth is email + phone primary (both required, email canonical, phone E.164 unique) with **required 2FA (TOTP via otplib/qrcode + SMS/email OTP fallback) OR magic link** as passwordless alternative. GoogleStrategy, google-signin-button, oauth-callback, and GOOGLE_* env are deleted. Magic link is one-time 15m JWT via email, rate-limited, and satisfies 2FA when TOTP not enrolled.

## CAPABILITY

Forumo web-first MVP enables a buyer and seller to complete the full commerce lifecycle on a single launch market/currency/provider stack — registration through escrow release, dispute/refund, messaging, reviews, and admin ops (KYC/moderation/disputes/payouts) — from a deterministic, clean-checkout build (Node 22.23.2 / pnpm 11.19.0) with verifiable Prisma generation, centralized API contract, **email+phone primary with required 2FA (TOTP/SMS OTP) or magic link** (Google OAuth removed), safe Docker Compose defaults, health-aware integrations, gated demo auth, and production safety gates, so that a staging release candidate can be deployed, migrated, backed up, rolled back, and smoke-tested against measurable thresholds before launch.

## CONSTRAINTS

**Fixed — non-negotiable:**

- Node `22.23.2` and pnpm `11.19.0` are canonical (root `package.json:6-8`, `packageManager`). CI, `Dockerfile`, and local setup must match. `engines` + `packageManager` field is the single source.
- Deterministic Prisma: `pnpm --filter backend prisma:generate` must be reproducible; `prisma/schema.prisma` (1246 lines) drift vs generated client must be CI-checked (`prisma generate --check` or hash of `node_modules/.prisma/client`).
- API base URL contract: `NEXT_PUBLIC_API_BASE_URL` is canonical (per `apps/web/CLAUDE.md`), includes `/api/v1` suffix. `getApiBaseUrl()`/`getGatewayBaseUrl()` in `@forumo/shared:112` is the single helper; `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` are deprecated.
- Demo auth prohibition: production must not run with `NEXT_PUBLIC_USE_API_MOCKS=true`, `MockApiClient` (`apps/web/src/lib/api-client.ts:314`), or `mock-token`/`dev-moderation-token` (`docker-compose.yml:76,88`). Health checks must surface disabled integrations explicitly.
- Protected changes (AGENTS.md): payment/payout/escrow/auction settlement, DB migrations, prod deploys/secrets, and AI governance files require explicit ABADO approval.

**Architecture preference (do not invent product truth):**

- Web-first MVP defers: native Android/iOS, auctions (`Auction`/`Bid` models), advanced inventory (`InventoryReservation`), multiple markets/currencies, advanced analytics, subscriptions/wallet/crypto/ML risk scoring.
- Docker Compose dev defaults must be safe: `dev-super-secret-key-change-in-prod` (`docker-compose.yml:86`) must not reach prod; healthchecks for postgres/redis/minio required before `backend` start.
- Centralized error/ownership enforcement server-side; UI visibility is not authorization (`RolesGuard`, `JwtAuthGuard` per-controller, `Pricing` etc.).

**Trust boundaries:**

- Payment providers (Stripe primary, Paystack for NGN/GHS/KES/ZAR per `PaymentProviderFactory`), Shippo, Mailgun, SNS, Google OAuth, MinIO are external. All inputs at boundary require Zod validation (`nestjs-zod`), webhook HMAC verification before processing, and no raw `fetch` duplication in frontends.

## IMPLEMENTATION CONTRACT

**Actors:**

- Buyer, Seller, Admin, Moderator, Operator (SRE), CI system.
- Surfaces: `apps/web` (buyer/seller), `apps/admin` (staff), `apps/backend` (`/api/v1`), `apps/moderation-service`, `apps/mobile` (deferred).

**Required states & transitions:**

- **Build reproducibility:** `clean checkout → pnpm install --frozen-lockfile → prisma:generate → typecheck/lint/test/build` must pass on CI with pinned Node/pnpm. Design-system (`packages/design-system`) must have its own `typecheck`, `test`, and coverage in CI (currently only `web`/`backend` covered).
- **Prisma:** `schema.prisma` → `prisma generate` → client artifact. States: `in-sync` / `drift`. CI must fail on drift; `prisma migrate deploy` for prod, `prisma migrate dev` only in dev.
- **API contract:** `NEXT_PUBLIC_API_BASE_URL` → `ForumoApiClient` → typed namespaces. No frontend `fetch` duplication. OAuth exchange: backend sets httpOnly `oauth_token` cookie → `GET /auth/oauth/exchange` → `signIn("token-auth")`. Cancellation/failure must redirect to `/login?error=oauth_failed` (already in `oauth-callback.tsx:28`).
- **Auth:** registration → email verification → login → 2FA (if enabled) → session (15m) → refresh via `POST /api/v1/auth/refresh` with Bearer refresh token → force re-login on 401. Google OAuth: success / user-cancel / missing `GOOGLE_CLIENT_ID/SECRET` (warn at `google.strategy.ts:30`, health check).
- **Docker:** `docker-compose up` with safe defaults must achieve `service_healthy` for postgres/redis/minio before backend; `web` depends on `backend`; all services expose healthz.
- **Integrations health:** `/healthz` and `/metrics` must report `enabled: false` for Stripe/Paystack/Shippo/Mailgun/SNS/Google when keys absent, not throw. Production boot must fail if mocks enabled.
- **Commerce (protected):** Order `PENDING → CONFIRMED → PAID → FULFILLED → DELIVERED → COMPLETED` (escrow `HOLDING → RELEASED/REFUNDED/DISPUTED`), `CANCELLED/REFUNDED/REFUND_PENDING/REFUND_FAILED/DISPUTED` branches. Escrow auto-release requires idempotent, concurrency-safe scheduler with dispute guard and failed-release recovery.
- **Admin:** `ADMIN` vs `MODERATOR` matrix must match backend `@Roles` and frontend nav/page checks; every critical route verified server-side ownership.

**Interfaces / inputs / outputs:**

- Inputs: env vars (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `STRIPE_*`, `SHIPPO_*`, `GOOGLE_*`, `NEXT_PUBLIC_API_BASE_URL`, `NEXTAUTH_SECRET/URL`, `MINIO_*`), user payloads (Zod DTOs), webhooks (Stripe/Paystack/Shippo).
- Outputs: typed `ForumoApiClient` responses, Prisma Client, OpenAPI (`docs/openapi.json`), health JSON, metrics (Prometheus), audit logs.
- Data implications: `User`, `Listing`, `Order`/`OrderItem`/`EscrowHolding`/`PaymentTransaction`/`Payout`/`Return`/`MessageThread`/`KycSubmission`/`Review`/`FeeSchedule` per `schema.prisma`; `FeeSchedule` relates to `ListingCategory`; `Payout.currency` defaults `zar`.

**Security / billing / policy:**

- CI: secret scanning (gitleaks/trufflehog), SAST (SAST), dependency scanning (pnpm audit), container scanning (trivy) — currently only `prettier/eslint/jest` in CI.
- Remaining advisories: `pnpm.overrides` pins 40+ packages (handlebars, vite, sharp, etc.) — must triage formally.
- Authorization: verify per-route `@UseGuards(JwtAuthGuard, RolesGuard)` + `assertAccountActive` + ownership checks; never trust UI hiding.
- Mock gating: `if (process.env.NODE_ENV === "production" && mocksEnabled) throw` at bootstrap.

**Observability / operator:**

- Dashboards/alerts for 5xx, auth failures, webhook `FAILED`, BullMQ backlog, escrow `HOLDING` > SLO, payout `FAILED`.
- Operator SOPs with SLAs for KYC, fraud, moderation, disputes, refunds, payouts (not yet defined).

## NON-GOALS

- Native Android/iOS release, auctions bidding engine, advanced inventory reservations, multi-market/multi-currency, advanced analytics/revenue dashboards beyond seller summary, subscriptions/wallet/crypto/ML risk scoring — all deferred per roadmap.
- This lane does not decide launch market, currency, payment/payout/shipping provider, or escrow auto-release days/hours — those are product decisions requiring ABADO approval before escrow code changes.
- No new design-system components beyond type-check/test fixes; no new marketing pages.

## OPEN QUESTIONS

1. **Launch market/currency/provider:** Which single market, currency, payment provider (Stripe vs Paystack), payout provider (Stripe Connect vs Paystack Transfers), shipping provider (Shippo vs disabled) to enable? Which provider/currency combos to _disable_ before launch?
2. **Escrow policy:** Auto-release after N days? Scheduler = `@nestjs/schedule` Cron vs BullMQ delayed job? Must disputes (`EscrowDispute OPEN/UNDER_REVIEW`) block release? Recovery/reconciliation strategy and alert channel?
3. **Sandbox verification:** Will ABADO provide Stripe/Paystack/Shippo sandbox keys and approve replay/failure-recovery test plan before code?
4. **Google OAuth:** Should missing `GOOGLE_CLIENT_ID/SECRET` hard-fail health in prod or degrade gracefully? How should user-cancelled OAuth (`access_denied`) be surfaced vs generic `oauth_failed`?
5. **Design-system CI:** Expected coverage threshold for `packages/design-system`? Same 80% as backend or lower?
6. **Prisma drift check:** Prefer `prisma generate` hash check vs `prisma validate` vs dedicated `check:prisma` script? Where to store baseline?
7. **Operator SLAs:** Target response times for KYC (hours), disputes (days), payouts (T+?), and on-call rotation before staging deploy?
8. **Secrets/prod env:** Where are production `JWT_SECRET`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL` sourced (Doppler/Vault/External Secrets)? Required for staging rehearshal.

## HANDOFF

**Needs product clarification first** on OPEN QUESTIONS 1-2 before any `escrow.service.ts` / `payouts.service.ts` / `returns.service.ts` mutation. Do not implement idempotent auto-release, payout, or provider sandbox tests until ABADO approves market/provider and escrow policy.

**Ready for direct implementation** (bounded, no extra approval) in this order per your sequencing:

1. **Foundations** → `tdd-workflow` + `verification-loop`: Align Node 22.23.2/pnpm 11.19.0 across `.nvmrc`/`.node-version`, CI (`/.github/workflows/*`), `apps/backend/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml`; prove clean-checkout CI (`pnpm install --frozen-lockfile`); add `check:prisma` drift script and CI job; finish `packages/design-system` typecheck/tests/coverage.
2. **API contract + Auth** → `api-design` + `security-review`: centralize `getApiBaseUrl()` already done in last hardening, now fix Google OAuth routing/cancellation/missing-config, gate `MockApiClient`/`dev-moderation-token` with prod invariant.
3. **Docker + Health** → `deployment-patterns`: make `docker-compose up` green with safe dev config, expose disabled integrations in `/healthz`.
4. **Commerce E2E (after 1-2 green)** → `e2e-testing` (Playwright): registration→escrow release, dispute/refund, messaging, admin ops, session-expiry.

Next lane after this artifact: `writing-plans` for Phase 1 (foundations), then `executing-plans` with `tdd-workflow`.
