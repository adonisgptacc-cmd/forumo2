# Plan: Repository Cleanup — Lint, Vulnerabilities, Next.js, OTel/Sentry, CSS, Prisma Migration

**Status:** Draft — awaiting owner approval (plan mode, no files edited outside this plan)
**Author:** Muse Spark (OpenCode) — 2026-08-21
**Scope:** Tasks 1–6 from user request (lint, image-size, workspace-root, OTel/Sentry, CSS import order, Prisma migration validation) + required completion checks
**Constraints:** `AGENTS.md` hard rules; do not deploy or run production migrations; do not start dev servers; TDD where behavior changes; preserve shared contracts

## Context

Recent high/critical remediation left new schema columns/enums (`Order.lastProviderEventAt`, `Order.auctionId`, `Payout.orderId`, `WebhookEvent.providerEventId`, `OrderStatus/PaymentStatus REFUND_*`) staged in `apps/backend/prisma/migrations/20260820_add_high_fixes/migration.sql` (not yet applied to prod). Lint debt is 421 backend + 30 mobile + 9 web warnings (explicit `any`, unused vars, hook deps, `<img>`). Mobile `image-size` CVE is via Metro/RN toolchain. Next.js web/admin infer wrong workspace root (`outputFileTracingRoot` missing). OTel/Sentry dynamic imports warn at build. Web/admin `globals.css` has `@import url(https://fonts...)` after `@import "tailwindcss"` → CSS import-order warning.

## Goals / Non-Goals

Goals: zero lint errors/warnings (all workspaces), documented image-size disposition, correct `outputFileTracingRoot`, no OTel/Sentry warnings with observability intact, correct `@import` order, migration validated on disposable DB with rollback documented.
Non-Goals: production deploy, prod migration apply, pnpm major upgrade, Expo/RN major upgrade unless safe patch exists.

## Approach — Task-by-Task

### 1) Resolve lint warnings (P0)
**Order:** backend → mobile → web (largest to smallest, respect `no-disable` rule)
- **Backend (421):** run `pnpm --filter backend lint` with `--format json` to bucket by rule (`no-explicit-any`, `no-unused-vars`, `react-hooks/exhaustive-deps`, `no-img-element` is web). For `any`: introduce proper types or `unknown` + narrowing; for `no-unused-vars`: prefix with `_` or remove; for hook deps: fix data-flow (add dep or memoize), not `// eslint-disable`. Keep `any` only where `Prisma.Json`/`Stripe` SDK requires it and add `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason` with justification + `TODO` to track.
- **Mobile (30):** `pnpm --filter @forumo/mobile lint`; fix `expo` unused imports, hook deps in providers, `any` in navigation types.
- **Web (9):** `pnpm --filter web lint`; fix `<img>` → `next/image` where appropriate or justify with `unoptimized` comment; hook deps.
- **Verification:** `pnpm lint` → 0/0; `pnpm format:check` passes; `pnpm typecheck` passes; targeted `jest` for changed modules.

### 2) React Native `image-size` vulnerabilities (P1)
- **Trace:** `pnpm --filter @forumo/mobile exec npm ls image-size` and `pnpm why image-size`; inspect `pnpm-lock.yaml` paths → `metro` / `@expo/metro-config` / `react-native` CLI. Check `pnpm audit --audit-level high` and `npm audit` JSON for CVE IDs and CVSS.
- **Upgrade check:** Try `pnpm --filter @forumo/mobile up expo@latest` dry-run, `react-native@0.73.x` patch, `metro` patch, `expo-cli` — only if `expo@50` peer compat allows; test with `pnpm --filter @forumo/mobile typecheck && pnpm --filter @forumo/mobile test`. Do **not** force override.
- **If no safe patch:** create `docs/SECURITY_IMAGE_SIZE.md` with affected paths, exploitability (dev-time image parsing, not runtime user input), mitigations (pin `image-size` via `pnpm.overrides` if audit allows, `npm audit` ignore with expiry), and upgrade path (Expo SDK 51/52 + RN 0.74).
- **Verification:** `pnpm audit --audit-level high`, `pnpm --filter @forumo/mobile typecheck`, `pnpm --filter @forumo/mobile test` (if suite exists).

### 3) Fix Next.js workspace-root warnings (P1)
- **Inspect:** `apps/web/next.config.mjs` and `apps/admin/next.config.mjs` — both currently lack `outputFileTracingRoot`. Check build logs: `pnpm --filter web build` warns `inferring workspace root`.
- **Fix:** add `import path from "path"` + `outputFileTracingRoot: path.join(import.meta.dirname, "../..")` (ESM) or `__dirname` variant. For `admin` also set `outputFileTracingRoot` to monorepo root (not `apps/admin`). Keep `transpilePackages`.
- **Constraint:** do not delete lockfiles outside repo; do not move `pnpm-workspace.yaml`.
- **Verification:** `pnpm --filter web build` and `pnpm --filter @forumo/admin build` → no workspace-root warning; `next build` traces from root.

### 4) Resolve OTel/Sentry build warnings (P1)
- **Investigate:** `apps/web/src/lib/observability.ts` or `instrumentation.ts` that imports `@opentelemetry/instrumentation` and `require-in-the-middle`; `apps/web/sentry.*.config.ts` and `apps/web/next.config.mjs` `withSentryConfig`. Run `pnpm --filter web build` and capture warnings: `Critical dependency: require function is used...` and `dynamic dependency`.
- **Fix:** Prefer `experimental.instrumentationHook: true` + `instrumentation.ts` lazy import via `import("@opentelemetry/instrumentation")` or `serverExternalPackages: ["require-in-the-middle"]` in `next.config.mjs`. For Sentry, pin `@sentry/nextjs` to `^8` compatible with `next@15 canary` or add `webpack: (c) => { c.externals.push("require-in-the-middle"); return c; }`. Verify `Sentry.init` still runs in `sentry.client.config.ts`.
- **Verification:** `pnpm --filter web build` and `pnpm --filter @forumo/admin build` with no OTel/Sentry warnings; `pnpm typecheck` passes; manual check `window.Sentry` and OTel `ConsoleSpanExporter` still logs.

### 5) Fix CSS import-order warning (P2)
- **Current:** `apps/web/src/app/globals.css:8` and `apps/admin/src/app/globals.css:8` have `@import url("https://fonts.googleapis.com...")` after `@import "tailwindcss"` → `!important` order warning.
- **Fix:** move Google Fonts `@import url(...)` to line 1 before `tailwindcss`, or replace with `next/font` (`next/font/google` `Geist`, `Newsreader`, `JetBrains_Mono`) and remove `@import url`. Prefer `next/font` for perf + no warning (add `apps/web/src/app/layout.tsx` font variables, update `globals.css` to use `var(--font-...)`).
- **Verification:** `pnpm --filter web build` and `admin build` → no `CSS import-order` warning; visual check fonts load; `pnpm lint` passes.

### 6) Validate pending Prisma migration safely (P0, protected)
- **File:** `apps/backend/prisma/migrations/20260820_add_high_fixes/migration.sql` (enums `REFUND_*`, `Order.lastProviderEventAt`, `Order.auctionId @unique`, `WebhookEvent.providerEventId @unique`, `Payout.orderId @unique` FK).
- **Steps (disposable DB only, never prod):**
  1. `cp .env.example .env.test` with `DATABASE_URL=postgresql://forumo:forumo@localhost:5433/forumo_test?schema=public` (separate port/DB).
  2. `docker compose -f docker-compose.yml -f docker-compose.test.yml up -d postgres-test` (or `pg_tmp`).
  3. `DATABASE_URL=... pnpm --filter backend prisma:generate && DATABASE_URL=... pnpm --filter backend prisma:migrate:deploy` (or `prisma migrate dev --create-only` dry-run).
  4. Seed minimal data: `pnpm --filter backend exec prisma db seed` or manual `INSERT`; test existing `Payout` rows with `NULL orderId` remain, new rows enforce unique; attempt duplicate `orderId` → `P2002`.
  5. Test nullable legacy rows: `SELECT * FROM "Payout" WHERE "orderId" IS NULL`; verify `CREATE UNIQUE INDEX` uses `WHERE "orderId" IS NOT NULL` semantics (Postgres allows multiple NULLs).
  6. Rollback: `prisma migrate resolve --rolled-back` or `DROP INDEX/COLUMN` script in `docs/MIGRATION_ROLLBACK.md`.
- **Docs:** write `docs/MIGRATION_20260820.md` with validation steps, row counts, and rollback SQL (`ALTER TYPE ...` cannot be rolled back without recreate — document recreate steps).
- **Do not:** run against `DATABASE_URL` from `.env` (prod).

## Execution Order (respects dependencies)

1. **Lint backend** (1) — largest, unblocks typecheck for others.
2. **Lint mobile + web** (1) in parallel after backend.
3. **CSS import order** (5) — independent, quick win, can parallel with lint.
4. **Next.js workspace-root** (3) — after lint, before builds.
5. **OTel/Sentry** (4) — after Next.js config, before builds.
6. **image-size** (2) — after lint, needs audit + possibly upgrades; run in parallel with 3-5 if network allowed.
7. **Prisma migration validation** (6) — last, needs disposable DB; parallel with 2.

## Required Completion Checks (from user)

Run in order, all must pass before handoff:
```
pnpm format:check
pnpm lint          # expect 0 errors, 0 warnings (currently 421+30+9)
pnpm typecheck
pnpm test          # plus backend/mobile regression subsets
pnpm build         # web + admin must be warning-free
pnpm audit --audit-level high
pnpm test:deployment  # if present
pnpm test:ai-config
git diff --check
```
Additionally: `pnpm --filter backend test -- src/modules/users ...` and `pnpm --filter @forumo/mobile test` after lint.

## Risks & Mitigations

- **Lint `any` suppression temptation:** enforce `no-disable` rule; require justification comment and follow-up `TODO`.
- **Expo upgrade breaking:** `image-size` may require Expo SDK major bump → document instead of forcing.
- **Next.js `outputFileTracingRoot` breaking pnpm symlinks:** test `pnpm --filter web build` with `transpilePackages` still works; keep `pnpm-workspace.yaml` at root.
- **OTel `require-in-the-middle` externals:** marking as external may silence warnings but break instrumentation — verify `tracer.startSpan` still emits.
- **Prisma enum `ADD VALUE` is not transactional rollback-able:** document that rollback requires `DROP TYPE` recreate or new migration; keep `IF NOT EXISTS`.
- **CSS `next/font` change affects layout shift (CLS):** compare `next build` CSS size and font-display.

## Handoff Criteria (Definition of Done)

- `pnpm lint` 0/0, `format:check` pass, `typecheck` pass, `test` pass, `build` pass (web/admin no workspace/OTel/CSS warnings), `audit --audit-level high` clean or documented, migration validated on disposable DB with docs, `git diff --check` clean, no secrets, no generated artifacts committed.

## Open Questions for Owner

- Should `image-size` be pinned via `pnpm.overrides` if no safe upgrade, or documented as accepted risk until Expo 51?
- Is `next/font` preferred over `@import url` for Google Fonts (affects `layout.tsx`)?
