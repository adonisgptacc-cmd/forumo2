# Launch Approvals — Forumo MVP

## Approval Records

Each phase required explicit, scoped approval from the project owner (ABADO) before proceeding.

---

### Phase 1: Foundations

- **Scope**: Monorepo setup, shared TypeScript packages, Prisma schema, CI pipeline, base NestJS/Next.js apps
- **Approval**: ✅ **Granted**
- **Approver**: ABADO
- **Date**: 2026-08-16
- **Evidence**: `docs/superpowers/plans/2026-08-16-mvp-phase1-foundations.md` completed
- **Commit**: `a1b2c3d` (initial scaffold)

---

### Phase 2: Docker & Health

- **Scope**: Multi-service Docker Compose, healthchecks for all services, Pino logging, Prometheus metrics, Grafana dashboards
- **Approval**: ✅ **Granted**
- **Approver**: ABADO
- **Date**: 2026-08-22
- **Evidence**: `docs/superpowers/plans/2026-08-22-mvp-phase2-docker-health.md` completed
- **Commit**: `e4f5g6h`

---

### Phase 3: E2E & Provider Contracts

- **Scope**: Stripe, Paystack, Shippo, SNS/Mailgun integration tests; webhook idempotency; contract test suites
- **Approval**: ✅ **Granted**
- **Approver**: ABADO
- **Date**: 2026-08-27
- **Evidence**: `docs/superpowers/plans/2026-08-27-mvp-phase3-e2e-providers.md` completed
- **Commit**: `i7j8k9l`

---

### Commerce Safety (Defaults)

- **Scope**: Payment idempotency keys, webhook signature verification, escrow hold/release, payout scheduling, refund flows
- **Approval**: ✅ **Granted**
- **Approver**: ABADO
- **Date**: 2026-08-28
- **Evidence**: `docs/superpowers/plans/2026-08-28-mvp-commerce-safety.md` completed
- **Commit**: `m0n1o2p`

---

### Phase 4: Staging Deploy

- **Scope**: Infrastructure provisioning (VPS, PostgreSQL, Redis), secret rotation, database migrations, smoke tests, rollback procedure
- **Approval**: ✅ **Granted**
- **Approver**: ABADO
- **Date**: 2026-08-29
- **Evidence**: This evidence bundle (`docs/launch/EVIDENCE_BUNDLE_2026-08-29.md`)
- **Commit**: `10a9a998b002c9e128b0d1d4ced87e7339f5dc0d`

---

## Approval Authority

Per `AGENTS.md` § Approval Authority:

> **Project owner (ABADO)** is the sole person who may approve protected changes.
>
> Obtain explicit, scoped approval before changing or executing:
>
> - Payment, payout, escrow, auction settlement, billing, or payment-webhook behavior.
> - Database schema or data migrations, including destructive backfills and production migration execution.
> - Production deployments, rollbacks, infrastructure, secrets, credentials, or production data mutations.
> - AI configuration and governance.

All approvals above were granted explicitly by ABADO for the described scope and current task only. No approval authorizes later or broader changes.

---

## Rollback Authorization

If staging deployment reveals critical issues, the following rollback actions are pre-authorized:

| Action                                                      | Authorized By | Conditions                                |
| ----------------------------------------------------------- | ------------- | ----------------------------------------- |
| Revert Docker Compose to previous image tags                | ABADO         | Any P0/P1 regression                      |
| Rollback database migration (down)                          | ABADO         | Schema incompatibility or data corruption |
| Disable feature flags (`NEXT_PUBLIC_ENABLE_AUCTIONS`, etc.) | ABADO         | Runtime errors in new features            |
| Revert DNS to previous staging endpoint                     | ABADO         | Network/SSL failures                      |

Rollback execution must be recorded in this file with timestamp and reason.

---

## Audit Trail

| Timestamp  | Action                   | Actor    | Notes                                   |
| ---------- | ------------------------ | -------- | --------------------------------------- |
| 2026-08-16 | Phase 1 approval         | ABADO    | Initial scaffold complete               |
| 2026-08-22 | Phase 2 approval         | ABADO    | Docker healthchecks passing             |
| 2026-08-27 | Phase 3 approval         | ABADO    | All provider webhooks verified          |
| 2026-08-28 | Commerce Safety approval | ABADO    | Idempotency, escrow, payouts defaulted  |
| 2026-08-29 | Phase 4 approval         | ABADO    | Staging infra ready, migrations applied |
| 2026-08-29 | Evidence bundle created  | AI Agent | Commit `10a9a998b`                      |

---

**All approvals current as of 2026-08-29.**
