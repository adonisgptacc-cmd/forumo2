# Codebase Review (April 21, 2026)

## Scope and method

This review covered the entire repository at a systems level with focused deep-dives into the primary runtime surfaces (`apps/backend`, `apps/web`, `apps/mobile`, `packages/shared`) and execution of the backend automated suite to surface correctness issues.

## Executive summary

- The project is a mature multi-app monorepo with clear modular boundaries and good foundational architecture.
- The biggest current risk is **schema drift / compile-time breakage in backend modules and tests** (Prisma model fields and Stripe event typing mismatches).
- Test reliability is currently degraded by **environment coupling** (required env vars in unit/integration tests) and **fixture/data drift** (MIME validation tests).
- There is notable **type-safety debt** (heavy `any` usage) across shared API, web, and mobile layers that raises regression risk.

## Strengths observed

1. **Clear modular architecture**: backend modules are separated by domain (orders, listings, auth, messaging, etc.), with dedicated DTOs/services/controllers and specs.
2. **Broad test coverage footprint**: many backend modules have test files and multiple suites are passing.
3. **Operational primitives in place**: telemetry, observability, moderation service, and deployment manifests are present.
4. **Consistent monorepo structure** with shared package boundaries and docs for architecture/testing.

## High-priority findings

### 1) Backend compile-time type errors against Prisma client

From `pnpm -C apps/backend test -- --runInBand`, multiple suites fail at TypeScript compile due to model-field mismatches in `users.service.ts`:

- `website` field referenced in `userProfile.upsert(... create ...)` but not present in generated Prisma type.
- `listing.findMany({ where: { userId } ... select: { price } })` references fields not present in Prisma `ListingWhereInput`/`ListingSelect`.
- `order.select.totalAmount` and `review.where.authorId` similarly mismatch generated model types.

**Impact:** backend suites cannot reliably compile/run; indicates likely drift between Prisma schema/migrations and service/query code.

**Recommendation:** regenerate and align model usage in `users.service.ts` with actual schema fields (or update schema + migration if code is source of truth).

### 2) Stripe webhook event typing mismatch in payments controller

Tests report TypeScript errors in `payments.controller.ts` when checking `event.type === 'transfer.paid'` and `'transfer.failed'`.

**Impact:** invalid narrowing against current Stripe event union; potential dead code / compile failure depending on TypeScript settings.

**Recommendation:** switch to explicit event-type guard pattern supported by installed Stripe type defs, or handle transfer events via generic string checks with safe narrowing.

### 3) Test environment coupling: required JWT_SECRET in messaging tests

`messaging.spec.ts` fails because `MessagingModule` reads `ConfigService.getOrThrow('JWT_SECRET')` during module construction.

**Impact:** tests fail without external env setup, reducing CI/local determinism.

**Recommendation:** provide defaults in test modules, inject a test config provider, or isolate runtime config fetches away from module construction.

### 4) Storage tests invalid under stricter MIME magic checks

`storage.spec.ts` fixture uploads are rejected: declared `image/jpeg` does not match buffer signature.

**Impact:** storage suite now fails systematically; likely tests were not updated after security hardening.

**Recommendation:** replace mock buffers with valid fixture bytes for each MIME type under test.

## Medium-priority findings

### 5) Widespread `any` usage in app/web/mobile/shared surfaces

Static scan indicates broad `any` use in critical codepaths (API client payloads, screens, admin pages).

**Impact:** weaker compile-time contracts and increased runtime failure risk during refactors.

**Recommendation:** progressively replace `any` with `unknown` + runtime validation or concrete shared DTO types, prioritizing auth, checkout, and messaging flows.

### 6) Documentation-to-runtime drift risk

The codebase includes strong docs and roadmap notes, but currently observed test/typing failures suggest docs and runtime invariants can diverge over time.

**Recommendation:** enforce CI gates on TypeScript compile + test subsets by domain (auth/orders/listings/messaging/storage) to catch drift earlier.

## Prioritized remediation plan (suggested)

1. **Unblock compile/test red status:** fix Prisma field mismatches in users module and Stripe webhook event typing.
2. **Stabilize tests:** make module tests self-contained for env; refresh storage binary fixtures.
3. **Raise type safety floor:** ban new `any` in changed files; introduce shared typed payloads for highest-risk flows.
4. **Prevent recurrence:** add CI jobs for per-module compile + smoke specs and a schema/code drift check post-`prisma generate`.

## Commands run

- `pnpm -C apps/backend test -- --runInBand`
- `rg -n "TODO|FIXME|HACK|@ts-ignore|any\b|console\.log\(|eval\(" apps packages`
- `sed -n '1,220p' README.md`
- `sed -n '1,240p' apps/backend/src/modules/auth/auth.service.ts`
- `sed -n '1,260p' apps/backend/src/modules/orders/payments.service.ts`

