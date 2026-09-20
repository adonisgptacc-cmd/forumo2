# Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Forumo from current state to a reproducible, bootable, transaction-safe public-beta release across 4 sequential phases.

**Architecture:** Sequential phased execution — each phase must pass all acceptance criteria before the next begins. Phase 0 establishes toolchain trust, Phase 1 fixes auth/boot/escrow paths, Phase 2 secures mobile and verifies providers, Phase 3 enforces full CI and documentation.

**Tech Stack:** pnpm 11.19.0, Node 22.23.2, Turbo 2.x, NestJS 10, Next.js 15, Prisma 5, BullMQ (installed, unused for queues), `@nestjs/schedule` cron, Jest, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-18-release-readiness-design.md`

## Global Constraints

- Do not modify the escrow or auction state machines without explicit ABADO approval and architecture review
- Payment, payout, webhook, and escrow work must be idempotent, concurrency-safe, and tested before merge
- Never place real provider credentials or reusable secrets in source control
- Use Prisma schema and generated types as the backend data-model source of truth
- Keep `NEXT_PUBLIC_USE_API_MOCKS=false` in production; prevent demo auth from entering production builds
- Preserve the standard API envelope and shared `ForumoApiClient` contract
- Every behavior change follows TDD with 80%+ coverage on backend/shared
- TypeScript strict mode — no implicit `any`
- All request/response types use Zod schemas via `nestjs-zod`

---

## Phase 0 — Reproducible Engineering Baseline

### Task 0.1: Add Prisma lifecycle/CI drift check (RR-002)

**Files:**

- Modify: `apps/backend/package.json`
- Modify: `apps/backend/tsconfig.json`
- Create: `scripts/check-prisma-drift.mjs`
- Modify: `scripts/check-prisma.mjs`

**Interfaces:**

- Consumes: `apps/backend/prisma/schema.prisma`, generated Prisma client
- Produces: CI step that fails when schema and generated client are inconsistent

- [ ] **Step 1: Verify Prisma and @prisma/client versions are pinned**

Read `apps/backend/package.json` and confirm both `prisma` and `@prisma/client` use compatible pinned versions. If not, pin them.

- [ ] **Step 2: Create Prisma drift check script**

Create `scripts/check-prisma-drift.mjs` that:

1. Runs `npx prisma generate --schema prisma/schema.prisma` in `apps/backend/`
2. Runs `git diff --exit-code apps/backend/prisma/schema.prisma` to check if generated client changed
3. Exits non-zero if drift detected

```bash
node scripts/check-prisma-drift.mjs
```

Expected: exits 0 if no drift, exits 1 if schema/generated client mismatch.

- [ ] **Step 3: Add lifecycle hook to package.json**

Add a `postinstall` script in `apps/backend/package.json` that runs `npx prisma generate --schema prisma/schema.prisma` so a clean install cannot type-check without the generated client.

- [ ] **Step 4: Verify from clean checkout**

Run: `pnpm install --frozen-lockfile && pnpm --filter backend typecheck && pnpm --filter backend test`

Expected: all pass without manual `prisma generate` step.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-prisma-drift.mjs apps/backend/package.json
git commit -m "fix: add Prisma lifecycle hook and drift check (RR-002)"
```

---

### Task 0.2: Fix design-system type boundary (RR-003)

**Files:**

- Inspect: `packages/design-system/`
- Modify: `packages/design-system/package.json`
- Modify: `packages/design-system/tsconfig.json` (if needed)

- [ ] **Step 1: Inspect current Storybook type errors**

Run: `pnpm --filter @forumo/design-system typecheck`

Note all type errors related to Storybook. Check if `@storybook/react` is in `devDependencies` or missing entirely.

- [ ] **Step 2: Add missing Storybook type dependency or fix tsconfig**

If `@storybook/react` is missing: add it as a devDependency. If it's present but tsconfig excludes it: update `tsconfig.json` to include story files in type-check.

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @forumo/design-system typecheck`

Expected: zero type errors. All four `*.stories.tsx` files resolve their Storybook types.

- [ ] **Step 4: Add design-system tasks to Turbo**

Modify `turbo.json` to add `typecheck`, `test`, and `build` tasks for `@forumo/design-system`.

```json
"@forumo/design-system": {
  "typecheck": { "cache": false },
  "test": { "outputs": ["coverage/**"], "cache": false },
  "build": { "dependsOn": ["^build"], "outputs": ["dist/**"], "cache": false }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/ turbo.json
git commit -m "fix: resolve design-system type boundary and add CI tasks (RR-003)"
```

---

## Phase 1 — Release-Blocking Runtime Paths

### Task 1.1: Normalize web API base URL (RR-010)

**Files:**

- Create: `apps/web/src/lib/api-url.ts`
- Modify: `apps/web/src/lib/react-query/hooks.ts` (or wherever `ForumoApiClient` is created)
- Modify: `apps/web/src/app/(authenticated)/**/*.tsx` (all pages using API URLs)
- Modify: `apps/admin/src/**/*.tsx`
- Modify: `apps/web/src/config/**` (or wherever NextAuth config lives)

**Interfaces:**

- Consumes: `NEXT_PUBLIC_API_BASE_URL` env var
- Produces: canonical `apiUrl(path: string): string` helper
- Must be consumed by: NextAuth config, `ForumoApiClient`, WebSocket setup, admin client

- [ ] **Step 1: Create the canonical URL helper**

Create `apps/web/src/lib/api-url.ts`:

```typescript
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function apiUrl(path: string): string {
  const cleanBase = BASE.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.includes("/api/v1/")) return `${cleanBase}${cleanPath}`;
  return `${cleanBase}/api/v1${cleanPath}`;
}
```

- [ ] **Step 2: Write failing tests for URL helper**

Create `apps/web/src/lib/api-url.test.ts`:

```typescript
import { apiUrl } from "./api-url";

describe("apiUrl", () => {
  it("prepends /api/v1 to paths without it", () => {
    expect(apiUrl("/auth/refresh")).toBe(
      "http://localhost:4000/api/v1/auth/refresh",
    );
  });
  it("does not duplicate /api/v1", () => {
    expect(apiUrl("/api/v1/auth/refresh")).toBe(
      "http://localhost:4000/api/v1/auth/refresh",
    );
  });
  it("handles trailing slash on base", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000/";
    expect(apiUrl("/auth")).toBe("http://localhost:4000/api/v1/auth");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter web test -- --testPathPattern=api-url`

Expected: FAIL (test file doesn't exist yet or assertions fail).

- [ ] **Step 4: Replace all hardcoded URL construction**

Find all instances of string concatenation that build API URLs. Replace with `apiUrl()`. Key files to check:

- NextAuth config (`auth.ts` or similar)
- `ForumoApiClient` instantiation
- WebSocket URL setup
- Admin client construction
- Server actions that call the backend

- [ ] **Step 5: Fix NextAuth token refresh**

In the NextAuth config, ensure the refresh endpoint uses `apiUrl("/auth/refresh")` rather than manually concatenating `/api/v1/auth/refresh`.

- [ ] **Step 6: Run full web typecheck and tests**

Run: `pnpm --filter web typecheck && pnpm --filter web test`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/api-url.ts apps/web/src/lib/api-url.test.ts
git commit -m "fix: normalize web API base URL via canonical helper (RR-010)"
```

---

### Task 1.2: Fix Google OAuth routing (RR-011)

**Files:**

- Modify: `apps/web/src/components/auth/google-signin.tsx` (or equivalent)
- Modify: `apps/web/src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Find the Google sign-in component**

Search for the Google sign-in button. Confirm it currently points to admin port 3001 or constructs its own OAuth URL.

- [ ] **Step 2: Redirect to backend OAuth endpoint**

Replace any local OAuth initiation with a redirect to `apiUrl("/auth/google")` (or whatever the backend Google OAuth endpoint is).

- [ ] **Step 3: Validate callback URLs**

In the NextAuth config, confirm `callbackUrl` and `signIn` URLs match the Google provider configuration. Add a startup validation that throws if the configured callback URL doesn't match the Google dashboard.

- [ ] **Step 4: Add error handling for missing credentials**

If Google credentials are not configured, the sign-in button should render a disabled state with an error message, not crash.

- [ ] **Step 5: Test**

Run: `pnpm --filter web test` and manually verify the OAuth flow with `NEXT_PUBLIC_USE_API_MOCKS=true`.

Expected: sign-in always starts on backend; missing credentials produce intentional disabled state.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/auth/
git commit -m "fix: correct Google OAuth routing to backend (RR-011)"
```

---

### Task 1.3: Make Docker stack bootable and honest (RR-012)

**Files:**

- Modify: `docker-compose.yml`
- Modify: `docker-compose.override.yml`
- Modify: `apps/backend/src/main.ts` (backend env validation)
- Modify: `apps/backend/src/modules/health/health.controller.ts` (health output)
- Create: `apps/backend/src/config/config.schema.ts` (or update existing)

**Interfaces:**

- Consumes: `.env` values for all external services
- Produces: health endpoint that reports disabled integrations; Docker stack that boots without crashing on missing optional services

- [ ] **Step 1: Audit backend env validation**

Read `apps/backend/src/main.ts` `validateEnv()`. Confirm which variables are hard-required vs optional. Ensure only `DATABASE_URL` and `JWT_SECRET` are hard-required.

- [ ] **Step 2: Remove hard-coded secrets from Docker Compose**

Replace any hard-coded secrets in `docker-compose.yml` and `docker-compose.override.yml` with `${ENV_VAR}` references that read from `.env`.

- [ ] **Step 3: Add health output for disabled integrations**

In the health controller, add a `capabilities` field that reports which external integrations (Stripe, Paystack, Shippo, email, SMS, OAuth) are enabled or disabled based on env vars.

```typescript
@Get("health")
getHealth() {
  return {
    status: "ok",
    capabilities: {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      paystack: !!process.env.PAYSTACK_SECRET_KEY,
      shippo: !!process.env.SHIPPO_API_KEY,
      email: !!process.env.MAILGUN_API_KEY,
      sms: !!process.env.SNS_ACCESS_KEY_ID,
      oauth: !!process.env.GOOGLE_CLIENT_ID,
    },
  };
}
```

- [ ] **Step 4: Add Docker Compose health checks**

Add `healthcheck` to each service in `docker-compose.yml` that verifies the service is actually ready (not just running). Example for backend:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:4000/api/v1/health"]
  interval: 10s
  timeout: 5s
  retries: 5
```

- [ ] **Step 5: Write config-schema tests**

Create `apps/backend/test/config-schema.spec.ts` that validates the config schema against development, test, and production matrices.

- [ ] **Step 6: Verify docker compose up**

Run: `pnpm docker:up && pnpm db:setup && pnpm dev`

Expected: all services reach healthy state; missing integrations show as disabled in health output.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml docker-compose.override.yml apps/backend/src/modules/health/ apps/backend/test/config-schema.spec.ts
git commit -m "fix: make Docker stack bootable with honest health output (RR-012)"
```

**Note:** RR-013 (escrow auto-release) requires explicit ABADO approval per `AGENTS.md` before implementation. This task is blocked pending approval.

---

### Task 1.4: Safe escrow auto-release (RR-013) — BLOCKED on approval

> **Protected change:** Modifying the escrow state machine requires explicit ABADO approval per `AGENTS.md` Section 3. Do not implement until approval is recorded.

**Files:**

- Modify: `apps/backend/src/modules/escrow/escrow.service.ts`
- Modify: `apps/backend/src/modules/escrow/escrow.controller.ts`
- Create: `apps/backend/src/modules/escrow/escrow-auto-release.processor.ts`
- Create: `apps/backend/src/modules/escrow/escrow-auto-release.spec.ts`

**Acceptance criteria:**

- Every eligible expired hold processed exactly once
- Disputed, refunded, already released holds never release
- Idempotent and concurrency-safe
- Audit trail for automatic releases
- Dispute cancels pending auto-release
- Unit tests for every eligibility branch, integration tests for concurrency

See `docs/ROADMAP.md` RR-013 for full specification.

---

## Phase 2 — Client and Commerce Integration

### Task 2.1: Remove mobile demo auth (RR-020)

**Files:**

- Search: `apps/mobile/src/` for `demo-access-token`, `demo-login`, `demo` auth logic
- Modify: `apps/mobile/src/auth/` (auth flow)
- Create: `apps/mobile/src/auth/dev-auth-flag.ts` (dev-only feature flag)

- [ ] **Step 1: Find all demo auth references**

Run: `rg "demo" apps/mobile/src/ --type ts`

Document every instance of `demo-access-token`, `demo-login`, or unconditional demo auth.

- [ ] **Step 2: Remove unconditional demo-login path**

Delete or gate behind an explicit dev-only build flag. The app must never appear authenticated with demo credentials outside explicit development mode.

```typescript
// Example: only enable demo auth in development
const isDev = process.env.NODE_ENV === "development" && __DEV__;
export function useAuth() {
  if (isDev && shouldUseDemoAuth()) {
    return useDemoAuth();
  }
  return useRealAuth();
}
```

- [ ] **Step 3: Ensure production build validation fails**

Add a build-time check that fails if demo auth code is included in a production bundle. Add to the mobile app's build script or CI config.

- [ ] **Step 4: Add secure token storage review**

Review how access and refresh tokens are stored on the device. Replace any insecure storage with secure storage (e.g., `expo-secure-store`).

- [ ] **Step 5: Test**

Run: `pnpm --filter mobile test` and verify the app does not auto-authenticate with demo tokens.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/auth/
git commit -m "fix: remove unsafe mobile demo auth (RR-020)"
```

---

### Task 2.2: Make mobile API configuration device-safe (RR-021)

**Files:**

- Search: `apps/mobile/src/` for `localhost`, `127.0.0.1`, `10.0.2.2`
- Modify: `apps/mobile/src/config/api-config.ts` (or equivalent)

- [ ] **Step 1: Find hardcoded localhost defaults**

Run: `rg "localhost" apps/mobile/src/ --type ts`

Document all hardcoded API base URLs.

- [ ] **Step 2: Replace with environment/profile configuration**

Create a configuration system that reads the API base URL from an environment variable, profile file, or development settings screen. Document the following base URLs:

- Android emulator: `10.0.2.2:4000`
- iOS simulator: `localhost:4000`
- Physical LAN device: `<host-ip>:4000`
- Staging: `<staging-url>`
- Production: `https://forumo.africa/api/v1`

- [ ] **Step 3: Add in-app diagnostic**

Create a development-only screen showing environment, API origin, and backend health without exposing secrets.

- [ ] **Step 4: Test**

Verify a physical device can reach the backend using documented configuration. Confirm release builds have no localhost fallback.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/config/
git commit -m "fix: make mobile API configuration device-safe (RR-021)"
```

---

### Task 2.3: Verify payment and shipping providers (RR-022)

**Files:**

- `apps/backend/src/modules/payments/` (Stripe and Paystack services)
- `apps/backend/src/modules/payouts/` (Stripe Connect)
- `apps/backend/src/modules/shipping/` (Shippo)
- `apps/backend/test/` (integration tests)

- [ ] **Step 1: Define supported currency/provider combinations**

Create a configuration that maps currencies to providers:

- USD/EUR/GBP → Stripe
- NGN → Paystack
- GHS/KES → Paystack (marked "unverified" for transfer-recipient types)

- [ ] **Step 2: Write provider sandbox tests**

Create integration tests that exercise:

- Stripe PaymentIntent creation and confirmation
- Stripe Connect onboarding and payout
- Paystack charge, verify, and transfer
- Shippo label purchase, tracking, and signature rejection
- Webhook replay/idempotency for every provider

```typescript
describe("Stripe webhook replay", () => {
  it("rejects duplicate webhook events", async () => {
    // Send same webhook event twice
    // Second should be idempotent — no duplicate order
  });
});
```

- [ ] **Step 3: Verify raw-body preservation**

Confirm all webhook controllers preserve the raw body for signature verification. Check `rawBody: true` is set in NestJS factory config.

- [ ] **Step 4: Write reconciliation runbooks**

Create `docs/operator-runbooks/provider-reconciliation.md` covering:

- Provider success with local failure
- Local success with delayed provider events
- Webhook signature rotation procedures

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/provider/ docs/operator-runbooks/
git commit -m "test: verify all payment/shipping providers end-to-end (RR-022)"
```

---

### Task 2.4: Verify mobile critical path against live backend (RR-023)

**Files:**

- `apps/mobile/src/` — all screens
- `apps/mobile/src/tests/` (new)

- [ ] **Step 1: Cover auth flows**

Test register, login, refresh, and logout against a live backend. Verify token storage and session expiry behavior.

- [ ] **Step 2: Cover critical user journeys**

Test: browse/search, listing detail, cart variants, checkout, payment handoff, order status, offers, auctions, messaging, push notifications, KYC, reviews, seller flows.

- [ ] **Step 3: Replace ad hoc error handling**

Replace screen-level API error handling with consistent retry/error/session-expiry behavior using a shared error handler.

- [ ] **Step 4: Test on real devices**

Run on at least one Android emulator and one iOS simulator. Document results.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/tests/
git commit -m "test: verify mobile critical paths against live backend (RR-023)"
```

---

## Phase 3 — Quality and Release Gates

### Task 3.1: Full automated verification pipeline (RR-030)

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `turbo.json`
- Modify: root `package.json` scripts

- [ ] **Step 1: Verify all root commands pass from clean checkout**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build`

Document results and fix any failures.

- [ ] **Step 2: Add all workspace packages to CI gates**

Ensure `apps/backend`, `apps/web`, `apps/admin`, `apps/mobile`, `apps/moderation-service`, `packages/shared`, `packages/design-system`, `packages/config` all have appropriate CI tasks.

- [ ] **Step 3: Require Prisma generation before backend compilation**

Add a CI step that runs `pnpm --filter backend prisma:generate` before `pnpm --filter backend build`. Fail if the generated client is out of sync.

- [ ] **Step 4: Separate env/sandbox failures from test failures**

Update CI config so that missing external services don't cause test failures. Only genuine code failures should fail the pipeline.

- [ ] **Step 5: Publish package-level test counts and coverage**

Configure CI to output per-package test counts and coverage percentages.

- [ ] **Step 6: Enforce 80% coverage on critical packages**

Configure Jest coverage thresholds for `apps/backend` and `packages/shared`.

```json
// backend package.json or jest.config.ts
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml turbo.json
git commit -m "ci: full automated verification pipeline (RR-030)"
```

---

### Task 3.2: Burn down warning debt (RR-031)

**Files:**

- `apps/backend/src/` — all files with lint warnings
- `apps/web/src/` — all files with lint warnings
- `apps/mobile/src/` — all files with lint warnings

- [ ] **Step 1: Triage all backend lint warnings**

Run: `pnpm --filter backend lint`

Categorize: explicit `any`, unsafe values, unused security/payment code. Fix all.

- [ ] **Step 2: Fix React hook dependency warnings**

Run: `pnpm --filter web lint`

Fix all `useEffect` dependency warnings based on data-flow correctness, not blanket `// eslint-disable-next-line`.

- [ ] **Step 3: Replace unoptimized `<img>` usage**

Replace `<img>` tags with Next.js `<Image>` where appropriate. Document deliberate exceptions.

- [ ] **Step 4: Remove unused mobile values/imports**

Run: `pnpm --filter mobile lint`

Remove all unused imports and values. Verify effects don't capture stale auth/API state.

- [ ] **Step 5: Establish no-new-warnings CI policy**

Add a CI check that fails if any new lint warnings are introduced.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/ apps/web/src/ apps/mobile/src/
git commit -m "refactor: zero lint warnings across all workspaces (RR-031)"
```

---

### Task 3.3: Add release smoke tests (RR-032)

**Files:**

- `tests/smoke/` (new)
- `playwright.config.ts`
- `monitoring/dashboards/` (update)

- [ ] **Step 1: Create deterministic smoke suite**

Create Playwright smoke tests covering:

- Health/readiness endpoint
- Auth refresh flow
- Listing browse
- Checkout initiation
- Webhook rejection
- Messaging connection
- Admin authorization
- Mobile API reachability

```typescript
// tests/smoke/auth-refresh.spec.ts
test("auth refresh succeeds without logout", async ({ page }) => {
  await page.goto("/login");
  // login...
  await page.waitForTimeout(5000); // token expires
  await page.reload();
  // should refresh token, not logout
  expect(page.url()).not.toBe("/login");
});
```

- [ ] **Step 2: Verify production build vars**

Add a check that verifies `NEXT_PUBLIC_USE_API_MOCKS=false` in production builds and that all required `NEXT_PUBLIC_*` variables are present.

- [ ] **Step 3: Add alert checks**

Configure monitoring alerts for: auth refresh failure, payment webhook failure, escrow release failure, queue backlog, 5xx rate.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/
git commit -m "test: add release smoke tests and operational evidence (RR-032)"
```

---

### Task 3.4: Reconcile documentation with verified behavior (RR-033)

**Files:**

- Modify: `CLAUDE.md` (or `docs/ai/project-context.md`)
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/API-GATEWAY.md`
- Create: `docs/operator-runbooks/escrow-auto-release.md` (after RR-013 approval)

- [ ] **Step 1: Update production-readiness claims**

Update `docs/ai/project-context.md` to reflect verified build/test status rather than intended status. Change "PRODUCTION READY" labels to match actual verified state.

- [ ] **Step 2: Update testing commands**

Document the finalized package-manager and Prisma bootstrap workflows.

- [ ] **Step 3: Document canonical API URL semantics**

Update `docs/API-GATEWAY.md` with the canonical URL semantics from RR-010.

- [ ] **Step 4: Document local integration-disabled behavior**

Update `docs/DEPLOYMENT.md` with local integration-disabled behavior and production-required secrets.

- [ ] **Step 5: Record escrow architecture**

After RR-013 approval and implementation, record the escrow auto-release architecture, recovery, and operator runbook.

- [ ] **Step 6: Mark roadmap items complete**

Update `docs/ROADMAP.md` — mark items `[x]` only when acceptance criteria and verification evidence exist.

- [ ] **Step 7: Commit**

```bash
git add docs/
git commit -m "docs: reconcile documentation with verified behavior (RR-033)"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-18-release-readiness.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
