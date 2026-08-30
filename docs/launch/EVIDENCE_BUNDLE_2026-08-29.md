# Launch Evidence Bundle — 2026-08-29

## Release Metadata

| Field          | Value                                      |
| -------------- | ------------------------------------------ |
| **Commit SHA** | `10a9a998b002c9e128b0d1d4ced87e7339f5dc0d` |
| **Branch**     | `main`                                     |
| **Tag**        | `v0.1.0-rc.1` (to be created)              |
| **Date**       | 2026-08-29                                 |
| **Author**     | ABADO                                      |

---

## Test Results

### Backend (NestJS)

- **Test Suites**: 28 passed, 28 total
- **Tests**: 244 passed, 244 total
- **Coverage**: Not enforced (integration-heavy suite)
- **Command**: `pnpm test --filter=backend`

### Design System (@forumo/design-system)

- **Test Files**: 4 passed
- **Tests**: 24 passed
- **Coverage**: 100% (lines, branches, functions, statements)
- **Command**: `pnpm test --filter=@forumo/design-system`

### Web App (Next.js)

- **Test Files**: 4 passed
- **Tests**: 21 passed
- **Coverage**: 94.64% statements, 100% branches, 84.21% functions, 94.64% lines
- **Command**: `pnpm test --filter=web`

### Mobile App (Expo/React Native)

- **Test Suites**: 5 passed
- **Tests**: 10 passed
- **Snapshots**: 1 passed
- **Command**: `pnpm test --filter=@forumo/mobile`

### Shared Package (@forumo/shared)

- **Test Files**: 2 passed, 2 total
- **Tests**: 17 passed, 17 total
- **Recovery verification**: Re-run on 2026-08-30 after aligning the registration test fixture with the required password and phone contract.

### Admin App (@forumo/admin)

- **Tests**: No test suite configured (MVP gap)

### Config Package (@forumo/config)

- **Tests**: No test suite configured

---

## Build Results

| Package           | Build Status | Notes                                                         |
| ----------------- | ------------ | ------------------------------------------------------------- |
| **backend**       | ✅ Pass      | `pnpm build --filter=backend`                                 |
| **web**           | ✅ Pass      | `pnpm build --filter=web` (Next.js production build)          |
| **admin**         | ✅ Pass      | `pnpm build --filter=@forumo/admin`                           |
| **mobile**        | ✅ Pass      | `pnpm build --filter=@forumo/mobile` (Expo production bundle) |
| **design-system** | ✅ Pass      | `pnpm build --filter=@forumo/design-system`                   |
| **shared**        | ✅ Pass      | `pnpm build --filter=@forumo/shared`                          |
| **config**        | ✅ Pass      | `pnpm build --filter=@forumo/config`                          |

All builds complete without TypeScript errors.

---

## Coverage Summary

| Package           | Statements                       | Branches | Functions | Lines    |
| ----------------- | -------------------------------- | -------- | --------- | -------- |
| **design-system** | **100%**                         | **100%** | **100%**  | **100%** |
| **web**           | 94.64%                           | 100%     | 84.21%    | 94.64%   |
| **backend**       | Not measured (integration suite) | —        | —         | —        |
| **mobile**        | Not measured                     | —        | —         | —        |
| **shared**        | Not measured                     | —        | —         | —        |

**Design System achieves 100% coverage across all metrics** — the only package with full enforcement.

---

## Provider Integration Tests

### Stripe

| Test                                      | Status  | Details                                                                                       |
| ----------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| **Payment Success (4242 4242 4242 4242)** | ✅ Pass | `PaymentIntent` created, confirmed, webhook `payment_intent.succeeded` processed              |
| **Payment Failure (4000 0000 0000 0002)** | ✅ Pass | `PaymentIntent` fails with `card_declined`, webhook `payment_intent.payment_failed` processed |
| **Webhook Replay (idempotency)**          | ✅ Pass | Duplicate `payment_intent.succeeded` ignored via `StripeEvent` idempotency key                |
| **Refund Flow**                           | ✅ Pass | Full refund via API, webhook `charge.refunded` processed                                      |

### Paystack

| Test                     | Status  | Details                                                                                  |
| ------------------------ | ------- | ---------------------------------------------------------------------------------------- |
| **Test Card Success**    | ✅ Pass | Test card `4084 0840 8408 4081` charges successfully, webhook `charge.success` processed |
| **Webhook Verification** | ✅ Pass | Signature verified via `x-paystack-signature` header, idempotency enforced               |

### Shippo

| Test                 | Status  | Details                                                         |
| -------------------- | ------- | --------------------------------------------------------------- |
| **Label Creation**   | ✅ Pass | Shipment created, label purchased, tracking number returned     |
| **Tracking Webhook** | ✅ Pass | `TRACKING_STATUS_UPDATED` webhook received, order status synced |

### SNS / Mailgun (via Mailpit)

| Test                   | Status  | Details                                                                   |
| ---------------------- | ------- | ------------------------------------------------------------------------- |
| **Email Delivery**     | ✅ Pass | Transactional emails (magic link, order confirmation) received in Mailpit |
| **Webhook Processing** | ✅ Pass | `delivered`, `bounced`, `complained` events processed                     |

---

## Known Risks & Gaps

| #   | Risk                                                     | Severity | Mitigation / Status                                                                                                          |
| --- | -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Docker healthchecks require `curl` in runner images**  | Medium   | Base images updated to include `curl`; verified in CI. Documented in `DEPLOYMENT.md`.                                        |
| 2   | **Prisma drift check uses `git status` on ignored path** | Low      | `.gitignore` excludes `prisma/migrations/`; drift check runs against tracked schema only. MVP gap — will harden in Phase 5.  |
| 3   | **Magic link + 2FA interaction needs UX clarification**  | Medium   | Current flow: magic link signs in, then 2FA challenged on sensitive actions. Spec documented in `docs/product/auth-flow.md`. |
| 4   | **@forumo/shared test fixture drift**                    | Resolved | Registration fixture aligned with the current contract; 17/17 tests passed on 2026-08-30.                                    |
| 5   | **Admin & Config packages lack test suites**             | Low      | MVP scope — will add unit tests in Phase 5.                                                                                  |
| 6   | **No E2E tests against staging environment**             | Medium   | Playwright E2E scaffolded (`apps/web/e2e`), not yet run against live staging. Planned for Phase 5.                           |

---

## Phase Approvals

| Phase               | Description                                                          | Status          | Approved By | Date       |
| ------------------- | -------------------------------------------------------------------- | --------------- | ----------- | ---------- |
| **Phase 1**         | Foundations (monorepo, shared contracts, Prisma, CI)                 | ✅ **Approved** | ABADO       | 2026-08-16 |
| **Phase 2**         | Docker & Health (multi-service compose, healthchecks, observability) | ✅ **Approved** | ABADO       | 2026-08-22 |
| **Phase 3**         | E2E & Provider Contracts (Stripe, Paystack, Shippo, SNS)             | ✅ **Approved** | ABADO       | 2026-08-27 |
| **Commerce Safety** | Defaults (idempotency, webhook verification, escrow, payouts)        | ✅ **Approved** | ABADO       | 2026-08-28 |
| **Phase 4**         | Staging Deploy (infra, secrets, migrations, smoke tests)             | ✅ **Approved** | ABADO       | 2026-08-29 |

---

## Artifacts

- **Docker Images**: `forumo/backend:2026-08-29`, `forumo/web:2026-08-29`, `forumo/admin:2026-08-29`
- **Mobile Build**: Expo EAS build `v0.1.0-rc.1` (internal distribution)
- **Database Migration**: `20260829000000_mvp_schema` applied to staging
- **Secrets**: Rotated and stored in 1Password vault `Forumo/Staging`

---

## Sign-Off

This evidence bundle represents the state of the codebase at commit `10a9a998b002c9e128b0d1d4ced87e7339f5dc0d` on branch `main` as of 2026-08-29.

All Phase 1–4 approvals are recorded. Known risks are documented and tracked.

**Ready for staging deployment.**
