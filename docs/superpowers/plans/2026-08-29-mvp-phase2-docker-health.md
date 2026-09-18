# MVP Phase 2 — Docker, Health & Prod Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `docker-compose up` boot deterministically with safe dev defaults, expose disabled payment/shipping/email/SMS/OAuth integrations in health checks (instead of throwing), and guarantee production cannot run with mocks/demo tokens.

**Architecture:** Harden `docker-compose.yml` healthchecks/depends_on, add startup validation in `main.ts:19 validateEnv()` to fail prod if `NEXT_PUBLIC_USE_API_MOCKS` or `dev-*` secrets are set, extend `health.controller.ts` to report `integrations: { stripe: {enabled: bool}, paystack, shippo, mailgun, sns, oauth }`, and gate `MockApiClient`/`dev-moderation-token` via shared helper. No escrow/payment logic touched.

**Tech Stack:** Docker Compose, Postgres 16, Redis 7, MinIO, Node 22.23.2, NestJS, Prisma, pnpm 11.19.0

**Spec:** `docs/product/mvp-launch-capability.md` (Docker + Health + Demo auth prohibition)

## Global Constraints

- `docker-compose up` must achieve `service_healthy` for postgres/redis/minio before backend (already does), `web` depends on backend.
- `JWT_SECRET` and `DATABASE_URL` remain hard-required at `main.ts:20`; all other integrations must degrade gracefully (enabled:false) not throw.
- Production boot must throw if `NEXT_PUBLIC_USE_API_MOCKS=true` or `JWT_SECRET` contains `dev-` or `MODERATION_INTERNAL_TOKEN=dev-moderation-token`.
- `pnpm verify` must remain green (format/lint/typecheck/test/build).

---

### Task 1: Make Docker Compose boot with safe dev config

**Files:**

- Modify: `docker-compose.yml` — verify healthchecks, add `healthcheck` for backend/web, ensure safe dev env
- Modify: `docker-compose.override.yml` (if exists) — ensure dev overrides don't leak to prod
- Test: `docker-compose config` valid, `docker-compose up -d` reaches healthy

**Interfaces:**

- Consumes: existing `postgres:16-alpine`, `redis:7-alpine`, `minio`, `mailpit`, `jaeger` services
- Produces: deterministic boot where `backend` waits for `postgres/redis/minio` healthy

- [ ] **Step 1: Verify current compose healthchecks**

```bash
grep -A2 "healthcheck" docker-compose.yml
# Should show postgres pg_isready, redis ping, minio curl
```

- [ ] **Step 2: Add backend healthcheck**

```yaml
backend:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:4000/api/v1/healthz"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s
```

- [ ] **Step 3: Add web healthcheck and depends_on healthy backend**

```yaml
web:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  depends_on:
    backend:
      condition: service_healthy
```

- [ ] **Step 4: Validate compose**

```bash
docker-compose config > /dev/null && echo "compose valid"
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.override.yml
git commit -m "chore(docker): make compose boot healthy with backend/web healthchecks"
```

---

### Task 2: Expose disabled integrations in health checks

**Files:**

- Modify: `apps/backend/src/modules/health/health.controller.ts`
- Modify: `apps/backend/src/modules/health/health.service.ts`
- Test: `GET /api/v1/healthz` and `GET /api/v1/metrics` include integrations map

**Interfaces:**

- Consumes: `ConfigService` env (STRIPE_SECRET_KEY, PAYSTACK__, SHIPPO_API_KEY, MAILGUN__, SNS__, GOOGLE__ now removed)
- Produces: `GET /healthz` returns `{ status: "ok", integrations: { stripe: {enabled: bool}, paystack, shippo, mailgun, sns, oauth: {enabled: false, reason: "removed"} } }`

- [ ] **Step 1: Write failing test — health does not report integrations**

```ts
// apps/backend/src/modules/health/health.controller.spec.ts
test("health reports integrations", async () => {
  const res = await request(app).get("/api/v1/healthz");
  expect(res.body.integrations.stripe.enabled).toBeDefined();
});
```

- [ ] **Step 2: Implement health service to check env**

```ts
// health.service.ts
getHealth() {
  return {
    status: "ok",
    integrations: {
      stripe: { enabled: !!process.env.STRIPE_SECRET_KEY },
      paystack: { enabled: !!process.env.PAYSTACK_SECRET_KEY },
      shippo: { enabled: !!process.env.SHIPPO_API_KEY },
      mailgun: { enabled: !!process.env.MAILGUN_API_KEY },
      sns: { enabled: !!process.env.SNS_ACCESS_KEY_ID },
      oauth: { enabled: false, reason: "Google OAuth removed — magic link" },
      mocks: { enabled: process.env.NEXT_PUBLIC_USE_API_MOCKS === "true" },
    }
  }
}
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter backend test src/modules/health/health.controller.spec.ts
curl http://localhost:4000/api/v1/healthz | jq .integrations
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/health/*
git commit -m "feat(health): expose disabled integrations in healthz"
```

---

### Task 3: Gate demo auth and production mocks

**Files:**

- Modify: `apps/backend/src/main.ts:19` — validateEnv() to fail prod if mocks enabled
- Modify: `apps/backend/src/modules/auth/auth.service.ts` — gate mock tokens
- Modify: `apps/web/src/lib/api-client.ts:31` — MockApiClient prod guard
- Modify: `docker-compose.yml` — ensure dev-moderation-token not used in prod
- Test: `NODE_ENV=production NEXT_PUBLIC_USE_API_MOCKS=true pnpm --filter backend start` should throw

**Interfaces:**

- Consumes: `process.env.NODE_ENV`, `NEXT_PUBLIC_USE_API_MOCKS`, `MODERATION_INTERNAL_TOKEN`, `JWT_SECRET`
- Produces: prod boot throws `Production cannot run with mocks enabled` if misconfigured

- [ ] **Step 1: Add prod guard in main.ts**

```ts
function validateEnv() {
  const required = ["DATABASE_URL", "JWT_SECRET"];
  // ... existing ...
  if (process.env.NODE_ENV === "production") {
    if (process.env.NEXT_PUBLIC_USE_API_MOCKS === "true")
      throw new Error(
        "Production cannot run with NEXT_PUBLIC_USE_API_MOCKS=true",
      );
    if (process.env.JWT_SECRET?.includes("dev-"))
      throw new Error("Production JWT_SECRET must not contain dev-");
    if (process.env.MODERATION_INTERNAL_TOKEN === "dev-moderation-token")
      throw new Error("Production MODERATION_INTERNAL_TOKEN must be set");
  }
}
```

- [ ] **Step 2: Gate MockApiClient**

```ts
// apps/web/src/lib/api-client.ts
const useMocks =
  process.env.NEXT_PUBLIC_USE_API_MOCKS === "true" &&
  process.env.NODE_ENV !== "production";
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_USE_API_MOCKS === "true"
) {
  throw new Error("Production cannot run with mocks");
}
```

- [ ] **Step 3: Test prod guard**

```bash
NODE_ENV=production NEXT_PUBLIC_USE_API_MOCKS=true pnpm --filter backend exec node -e "require('./dist/main.js')" 2>&1 | grep -q "Production cannot run" && echo "gate ok"
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/main.ts apps/web/src/lib/api-client.ts docker-compose.yml
git commit -m "fix(security): gate demo auth and mocks in production"
```

---

## Self-Review

- Spec coverage: All Phase 2 Docker/health/demo items covered.
- No escrow/payment changes.
- Type consistency: health returns `{status, integrations}` matches existing controller.

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-29-mvp-phase2-docker-health.md`. Two execution options: subagent-driven or inline.
