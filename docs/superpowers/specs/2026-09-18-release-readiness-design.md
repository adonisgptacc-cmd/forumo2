# Release Readiness Design Spec

**Date:** 2026-09-18
**Status:** Draft — awaiting owner review
**Owner:** ABADO

## Purpose

Define the approach for bringing Forumo from current state to a reproducible, bootable, transaction-safe public-beta release. This spec covers all roadmap items (RR-001 through RR-033) organized in 4 sequential phases.

## Current State Summary

| Component | Status |
|-----------|--------|
| Backend (NestJS) | Production-ready, 26 modules, `tsc --noEmit` clean |
| Web (Next.js 15) | Typecheck clean, auth + 6 pages wired |
| Admin (Next.js 15) | Auth + 6 pages wired, typecheck clean |
| Mobile (Expo 50) | Pre-alpha, 27 screens, no tests, direct API calls |
| Shared | Production-ready (Zod schemas + ForumoApiClient) |
| Moderation (FastAPI) | Production-ready |
| Test coverage | ~15% |
| CI pipeline | Exists but root commands fail from clean checkout |
| Escrow auto-release | Cron-based via `@nestjs/schedule`, 14-day default |
| BullMQ | Installed, used for Redis only (not queued jobs) |

## Open Decisions (resolved)

1. **Mobile demo mode** — Remove completely. No `demo-access-token` in any build. Replace with explicit dev-only feature flag gated behind a build-time check.
2. **Supported markets** — GHS/KES seller payouts are NOT a launch requirement. Mark as "unverified" in code and docs. Only USD/EUR/GBP (Stripe) and NGN (Paystack) are launch-candidate currencies.
3. **Coverage scope** — Backend and `@forumo/shared` must reach 80% immediately. Web, admin, mobile follow in Phase 3.
4. **Local integrations** — Allow explicit disabled adapters. Extend the `NEXT_PUBLIC_USE_API_MOCKS` pattern: any missing external integration should fail gracefully with a logged warning, not crash. Production must fail closed.
5. **Escrow scheduler** — Confirmed: `@nestjs/schedule` cron jobs. BullMQ not needed for escrow auto-release. The existing `EscrowService` already uses cron. Auto-release window is 5 days (update from current 14-day default).

## Approach: Sequential Phased Execution

Execute phases in strict order. Each phase must pass all its acceptance criteria before the next begins. This preserves existing dependency chains documented in `docs/ROADMAP.md`.

### Phase 0 — Reproducible Engineering Baseline (RR-001, RR-002, RR-003)

**Goal:** A clean checkout can install, generate Prisma client, typecheck, and build without manual intervention.

- RR-001: Already complete (pnpm 11.19.0, Node 22.23.2 pinned)
- RR-002: Prisma generation must be deterministic — add CI drift check, lifecycle hook
- RR-003: Fix design-system Storybook type boundary

**Deliverables:** Clean-checkout `pnpm install --frozen-lockfile && pnpm typecheck && pnpm build` passes.

### Phase 1 — Release-Blocking Runtime Paths (RR-010, RR-011, RR-012, RR-013)

**Goal:** Authentication works correctly, Docker stack boots truthfully, escrow auto-release is safe.

- RR-010: Normalize web API base URL — single canonical helper, no duplication
- RR-011: Fix Google OAuth routing — always start on backend, validate callbacks
- RR-012: Make Docker stack bootable — remove hard-coded secrets, add health checks, disabled integrations visible in health output
- RR-013: Safe escrow auto-release — idempotent, concurrency-safe, dispute-aware (requires owner approval per AGENTS.md)

**Deliverables:** `docker compose up` reaches healthy state. Auth refresh and Google OAuth pass. Escrow auto-release is approved and tested.

**Protected change:** RR-013 modifies escrow state machine — requires explicit ABADO approval per `AGENTS.md`.

### Phase 2 — Client and Commerce Integration (RR-020, RR-021, RR-022, RR-023)

**Goal:** Mobile is secure and connected, all payment/shipping providers verified.

- RR-020: Remove unsafe mobile demo auth — replace with dev-only flag
- RR-021: Device-safe mobile API configuration — no localhost defaults
- RR-022: Provider sandbox verification — Stripe, Paystack, Shippo webhook replay tested
- RR-023: Mobile critical paths tested against live backend

**Deliverables:** Mobile app works without demo auth. Every supported payment/currency path has sandbox evidence.

### Phase 3 — Quality and Release Gates (RR-030, RR-031, RR-032, RR-033)

**Goal:** Full CI pipeline, zero warnings, smoke tests, documentation reconciled.

- RR-030: Full automated verification pipeline — all root commands pass from clean checkout
- RR-031: Burn down lint warnings — target zero
- RR-032: Release smoke tests and operational evidence
- RR-033: Reconcile documentation with verified behavior

**Deliverables:** `pnpm verify` passes. Release candidate has auditable evidence bundle.

## Acceptance Criteria (Overall Definition of Done)

- [ ] Clean-checkout install, type-check, lint, tests, E2E, and build pass
- [ ] Backend and Compose boot with documented configuration
- [ ] Auth refresh and Google OAuth pass browser E2E
- [ ] Escrow automatic release is approved, idempotent, dispute-safe, observable, recovery-tested
- [ ] Supported payment/shipping flows have provider-sandbox evidence
- [ ] Mobile critical paths pass against real backend without demo auth
- [ ] CI enforces 80%+ coverage on backend/shared, security scanning, no regression
- [ ] Release candidate smoke evidence and rollback instructions complete

## Fixed Constraints

- Do not modify escrow or auction state machines without explicit approval and architecture review
- Payment, payout, webhook, and escrow work must be idempotent, concurrency-safe, and tested before merge
- Never place real provider credentials or reusable secrets in source control
- Use Prisma schema and generated types as the backend data-model source of truth
- Keep `NEXT_PUBLIC_USE_API_MOCKS=false` in production
- Preserve the standard API envelope and shared `ForumoApiClient` contract
- Every behavior change follows TDD with 80%+ coverage target

## Non-Goals

- This plan does not cover feature development beyond release-readiness remediation
- Mobile is not required for the web-first public beta (unless explicitly in scope)
- Kubernetes deployment is documented but not part of this plan — it's a Phase 3 verification step
- No new feature development (search, auctions, inventory, etc.) — only remediation of existing gaps
