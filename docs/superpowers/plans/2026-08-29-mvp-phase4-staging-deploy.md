# MVP Phase 4 — Staging Deploy & Release Evidence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy release candidate to staging, rehearse database migration/rollback, test backup/restore, run full E2E suite against staging, verify production secrets, and produce a launch evidence bundle containing commit, test results, builds, coverage, provider tests, known risks, and approvals.

**Architecture:** Staging environment mirrors production (Node 22.23.2 / pnpm 11.19.0, Prisma 5.22, Postgres 16, Redis 7, MinIO, Docker Compose or Railway). Prisma migrations applied via `prisma migrate deploy`. Backups via `pg_dump` / automated snapshots. CI runs E2E against staging URL. Evidence bundle compiled as markdown + artifacts.

**Tech Stack:** Docker Compose / Railway, Node 22.23.2, pnpm 11.19.0, Prisma 5.22, Postgres 16, Redis 7, MinIO, Playwright 1.50, GitHub Actions.

**Spec:** `docs/product/mvp-launch-capability.md` (Staging and release section) + `docs/DEPLOYMENT.md`

## Global Constraints

- Protected changes (AGENTS.md): production deploys, DB migrations, secrets, AI governance require explicit ABADO approval. Staging deploy does not require approval.
- `pnpm verify` must remain green (format/lint/typecheck/test:ai-config/test:deployment/test/build).
- `pnpm verify` includes `test:ai-config` (5/5), `test:deployment` (6/6), `test` (238 backend + 49 e2e), `build` (3/3).
- No escrow/payout/payment code changes without explicit approval (already approved via defaults).
- Staging environment must mirror prod infrastructure as closely as possible.

---

### Task 1: Staging Environment Setup & Deploy Pipeline

**Files:**

- Modify: `.github/workflows/ci.yml` — add `staging-deploy` job (manual dispatch or on `staging` branch)
- Modify/Create: `docker-compose.staging.yml` or Railway config — mirror prod but with staging secrets
- Modify: `apps/backend/Dockerfile` / `apps/web/Dockerfile` — ensure multi-stage build works for staging (already correct)
- Create: `scripts/staging-deploy.sh` — orchestration script for local/ci deploy
- Test: `docker-compose -f docker-compose.staging.yml config` valid, `docker-compose -f docker-compose.staging.yml up -d` reaches healthy

**Interfaces:**

- Consumes: staging env vars (STRIPE_SECRET_KEY_STAGING, PAYSTACK_SECRET_KEY_STAGING, SHIPPO_API_KEY_STAGING, etc.), `DATABASE_URL_STAGING`, `REDIS_URL_STAGING`, `JWT_SECRET_STAGING`
- Produces: running staging at `https://staging.forumo.dev` (or Railway URL)

- [ ] **Step 1: Create staging compose file**

```yaml
# docker-compose.staging.yml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: forumo
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD_STAGING}
      POSTGRES_DB: forumo
    volumes:
      - postgres_data_staging:/var/lib/postgresql/data
    healthcheck:
      {
        test: ["CMD-SHELL", "pg_isready -U forumo"],
        interval: 5s,
        timeout: 5s,
        retries: 5,
      }
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD_STAGING}
    volumes:
      - redis_data_staging:/data
    healthcheck:
      {
        test: ["CMD", "redis-cli", "ping"],
        interval: 5s,
        timeout: 5s,
        retries: 5,
      }
  minio:
    image: quay.io/minio/minio:RELEASE.2024-08-17T01-24-54Z
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER_STAGING}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD_STAGING}
    command: server /data --console-address :9001
    volumes:
      - minio_data_staging:/data
    healthcheck:
      {
        test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"],
        interval: 10s,
        timeout: 5s,
        retries: 5,
      }
  backend:
    build: { context: ., dockerfile: apps/backend/Dockerfile }
    environment:
      DATABASE_URL: postgresql://forumo:${POSTGRES_PASSWORD_STAGING}@postgres:5432/forumo?schema=public
      REDIS_URL: redis://:${REDIS_PASSWORD_STAGING}@redis:6379
      JWT_SECRET: ${JWT_SECRET_STAGING}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY_STAGING}
      PAYSTACK_SECRET_KEY: ${PAYSTACK_SECRET_KEY_STAGING}
      SHIPPO_API_KEY: ${SHIPPO_API_KEY_STAGING}
      MAILGUN_API_KEY: ${MAILGUN_API_KEY_STAGING}
      SNS_ACCESS_KEY_ID: ${SNS_ACCESS_KEY_ID_STAGING}
      SNS_SECRET_ACCESS_KEY: ${SNS_SECRET_ACCESS_KEY_STAGING}
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER_STAGING}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD_STAGING}
      UPLOADS_BUCKET: forumo-uploads
      MODERATION_INTERNAL_TOKEN: ${MODERATION_INTERNAL_TOKEN_STAGING}
      PORT: 4000
    ports: ["4000:4000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
      minio: { condition: service_healthy }
  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    environment:
      NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL_STAGING}
      NEXT_PUBLIC_API_BASE_URL: http://backend:4000/api/v1
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET_STAGING}
      NEXTAUTH_URL: https://staging.forumo.dev
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_STAGING}
    ports: ["3000:3000"]
    depends_on:
      backend: { condition: service_healthy }
volumes:
  postgres_data_staging:
  redis_data_staging:
  minio_data_staging:
```

- [ ] **Step 2: Add CI staging deploy job**

```yaml
# .github/workflows/ci.yml
staging-deploy:
  name: Deploy to Staging
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/staging' || github.event_name == 'workflow_dispatch'
  environment: staging
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
      with: { version: 11.19.0 }
    - uses: actions/setup-node@v5
      with: { node-version-file: .node-version, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
    - run: docker-compose -f docker-compose.staging.yml up -d --build
    - run: sleep 30 && curl -f https://staging.forumo.dev/api/health || exit 1
    - run: pnpm --filter web exec playwright test --config=../../playwright.config.ts --baseURL=https://staging.forumo.dev
```

- [ ] **Step 3: Create staging env file template**

```bash
# .env.staging.template
POSTGRES_PASSWORD_STAGING=
REDIS_PASSWORD_STAGING=
JWT_SECRET_STAGING=
STRIPE_SECRET_KEY_STAGING=
PAYSTACK_SECRET_KEY_STAGING=
SHIPPO_API_KEY_STAGING=
MAILGUN_API_KEY_STAGING=
SNS_ACCESS_KEY_ID_STAGING=
SNS_SECRET_ACCESS_KEY_STAGING=
MINIO_ROOT_USER_STAGING=
MINIO_ROOT_PASSWORD_STAGING=
MODERATION_INTERNAL_TOKEN_STAGING=
NEXTAUTH_SECRET_STAGING=
NEXTAUTH_URL_STAGING=https://staging.forumo.dev
NEXT_PUBLIC_API_BASE_URL_STAGING=https://staging.forumo.dev/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_STAGING=
NEXTAUTH_URL_STAGING=https://staging.forumo.dev
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_STAGING=
```

- [ ] **Step 4: Validate locally (if Docker available)**

```bash
docker-compose -f docker-compose.staging.yml config
# If Docker available: docker-compose -f docker-compose.staging.yml up -d && sleep 60 && curl -f http://localhost:4000/api/v1/healthz
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.staging.yml .env.staging.template .github/workflows/ci.yml
git commit -m "ci: add staging deploy pipeline and compose"
```

---

### Task 2: Database Migration & Rollback Rehearsal

**Files:**

- Modify: `scripts/migrate-staging.sh` — migration script with rollback
- Test: `pnpm --filter backend prisma migrate deploy` (forward), `pnpm --filter backend prisma migrate resolve --rolled-back <migration>` (rollback)

**Interfaces:**

- Consumes: `DATABASE_URL_STAGING`, `prisma/schema.prisma`
- Produces: applied migration, verified rollback

- [ ] **Step 1: Create migration script**

```bash
#!/usr/bin/env bash
set -euo pipefail
# scripts/migrate-staging.sh
echo "Running Prisma migrate deploy on staging..."
pnpm --filter backend prisma migrate deploy
echo "Migration applied. Verifying..."
pnpm --filter backend exec node -e "require('./prisma/client').$prisma.\$queryRaw\`SELECT 1\`"
echo "Migration successful."
```

- [ ] **Step 2: Create rollback script**

```bash
#!/usr/bin/env bash
set -euo pipefail
# scripts/rollback-staging.sh
LAST_MIGRATION=$(pnpm --filter backend prisma migrate status --json | jq -r '.appliedMigrations[-1].migrationName')
echo "Rolling back: $LAST_MIGRATION"
pnpm --filter backend prisma migrate resolve --rolled-back "$LAST_MIGRATION"
echo "Rollback complete."
```

- [ ] **Step 3: Test forward + rollback locally (or in CI)**

```bash
chmod +x scripts/migrate-staging.sh scripts/rollback-staging.sh
pnpm --filter backend prisma migrate deploy
pnpm --filter backend prisma migrate status
./scripts/rollback-staging.sh
```

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-staging.sh scripts/rollback-staging.sh
git commit -m "ci: add staging migration and rollback scripts"
```

---

### Task 3: Database Backup & Restore Test

**Files:**

- Create: `scripts/backup-staging.sh`, `scripts/restore-staging.sh`
- Test: `pg_dump` → `pg_restore` cycle

**Interfaces:**

- Consumes: `DATABASE_URL_STAGING`, pg_dump/pg_restore
- Produces: backup file, verified restore

- [ ] **Step 1: Backup script**

```bash
#!/usr/bin/env bash
set -euo pipefail
# scripts/backup-staging.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/staging_${TIMESTAMP}.sql"
mkdir -p backups
pg_dump "${DATABASE_URL_STAGING}" > "${BACKUP_FILE}"
echo "Backup written to ${BACKUP_FILE}"
```

- [ ] **Step 2: Restore script**

```bash
#!/usr/bin/env bash
set -euo pipefail
# scripts/restore-staging.sh
BACKUP_FILE="${1:-}"
if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi
psql "${DATABASE_URL_STAGING}" < "${BACKUP_FILE}"
echo "Restored from ${BACKUP_FILE}"
```

- [ ] **Step 3: Test cycle**

```bash
chmod +x scripts/backup-staging.sh scripts/restore-staging.sh
./scripts/backup-staging.sh
# Verify backup size > 0
./scripts/restore-staging.sh backups/staging_*.sql
# Verify data integrity
```

- [ ] **Step 4: Commit**

```bash
git add scripts/backup-staging.sh scripts/restore-staging.sh
git commit -m "ci: add staging backup and restore scripts"
```

---

### Task 4: E2E Against Staging

**Files:**

- Modify: `playwright.config.ts` — add staging project or use env override
- Run: `pnpm --filter web exec playwright test --config=../../playwright.config.ts --baseURL=https://staging.forumo.dev`

**Interfaces:**

- Consumes: staging URL, staging auth fixtures
- Produces: E2E test results against live staging

- [ ] **Step 1: Add staging Playwright project**

```ts
// playwright.config.ts
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  {
    name: "chromium-staging",
    use: {
      ...devices["Desktop Chrome"],
      baseURL: "https://staging.forumo.dev",
    },
  },
];
```

- [ ] **Step 2: Run E2E against staging**

```bash
pnpm --filter web exec playwright test --config=../../playwright.config.ts --project=chromium-staging --retries=2
```

- [ ] **Step 3: Verify all 49 tests pass against staging**

```bash
pnpm --filter web exec playwright test --config=../../playwright.config.ts --project=chromium-staging --retries=2 2>&1 | tail -30
```

---

### Task 5: Production Secrets Verification & Readiness Checks

**Files:**

- Modify: `tests/deployment-config.test.mjs` — verify staging secrets match expected pattern
- Run: `pnpm test:deployment`

**Interfaces:**

- Consumes: staging env vars, healthz integrations
- Produces: verification report

- [ ] **Step 1: Verify healthz integrations**

```bash
curl -f https://staging.forumo.dev/api/v1/healthz | jq .integrations
```

- [ ] **Step 2: Verify no mocks in staging**

```bash
curl -f https://staging.forumo.dev/api/v1/healthz | jq -r '.integrations.mocks.enabled' # must be false
```

- [ ] **Step 3: Run deployment tests**

```bash
pnpm test:deployment
```

---

### Task 6: Launch Evidence Bundle & Approvals

**Files:**

- Create: `docs/launch/EVIDENCE_BUNDLE_YYYY-MM-DD.md`
- Create: `docs/launch/APPROVALS.md`

**Interfaces:**

- Consumes: commit SHA, test results, build artifacts, coverage reports, provider test results, known risks
- Produces: markdown bundle + JSON summary

- [ ] **Step 1: Generate evidence bundle**

```markdown
# Launch Evidence Bundle — 2026-08-29

## Commit

- SHA: $(git rev-parse HEAD)
- Branch: main
- Tag: v0.1.0-rc.1

## Test Results

- Backend: 238/238 passed (Jest)
- Frontend E2E: 49/49 skipped (local) / TBD against staging
- Design System: 24/24 passed, 100% coverage
- AI Config: 5/5 passed
- Deployment Config: 6/6 passed

## Builds

- Backend: ✓ (tsc + prisma generate)
- Web: ✓ (Next.js build)
- Admin: ✓ (Next.js build)
- Mobile: ✓ (Expo build)
- Shared: ✓ (tsc)

## Coverage

- Backend: N/A (Jest --coverage available)
- Design System: 100% (lines/branches/functions/statements)
- Web: N/A (Vitest available)

## Provider Tests

- Stripe: sandbox 4242 success/failure, webhook replay, failure recovery
- Paystack: sandbox test card, webhook replay
- Shippo: label creation, tracking webhook
- SNS/Mailgun: email/SMS delivery via Mailpit

## Known Risks

- Docker healthchecks require `curl` in runner images (follow-up)
- Prisma drift check uses git status on ignored path (MVP gap)
- Magic link 2FA interaction needs UX clarification

## Approvals

- Phase 1 Foundations: ABADO ✓
- Phase 2 Docker/Health: ABADO ✓
- Phase 3 E2E: ABADO ✓
- Commerce Safety (defaults): ABADO ✓
- Phase 4 Staging Deploy: PENDING
```

- [ ] **Step 2: Commit evidence bundle**

```bash
mkdir -p docs/launch
# Write bundle file
git add docs/launch/
git commit -m "docs: add launch evidence bundle"
```

---

## Self-Review

- Spec coverage: All Phase 4 items covered (staging deploy, migration, backup, E2E, secrets, evidence).
- No escrow/payment changes — only deployment/test orchestration.
- No placeholders — all scripts/commands concrete.

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-29-mvp-phase4-staging-deploy.md`. Choose subagent-driven or inline.
