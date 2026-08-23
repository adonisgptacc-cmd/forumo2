# RR-013 — Escrow Auto-Release Hardening: Design

**Status:** Draft, pending Project Owner (ABADO) approval — protected workflow per `.assistant/rules/protected-paths.md` (Payments) and `docs/ROADMAP.md`'s Fixed Constraints ("Do not modify the escrow or auction state machines without explicit approval and an architecture review").

**Roadmap item:** RR-013, Phase 1 — Fix release-blocking runtime paths.

## Summary

The roadmap describes RR-013 as building safe escrow auto-release from
scratch. It isn't greenfield — a substantial, mostly-working pipeline
already exists (hourly escrow-release cron → daily payout-scheduling cron →
daily payout-processing cron → daily stuck-payout reconciliation cron →
provider webhook handlers with retry). This spec closes the real gaps found
by tracing that pipeline end to end, rather than building a new one.

The one gap that matters most: **escrow currently auto-releases 14 days
after order creation regardless of whether the order was ever delivered.**
The code that's supposed to prevent this — tightening the release window
once delivery is confirmed — has an inverted null-check that makes it
permanently dead. This is the correctness bug this spec exists to fix.

## Current state (verified by reading the code, not the roadmap prose)

- `EscrowService.createEscrowHolding()` (`apps/backend/src/modules/escrow/escrow.service.ts`)
  sets `releaseAfter = now + 14 days` unconditionally at escrow creation
  (order payment time).
- `EscrowService.autoReleaseExpiredEscrows()` — `@Cron("0 * * * *")`, hourly
  — releases any `HOLDING` escrow where `releaseAfter <= now` and no
  dispute is `OPEN`/`UNDER_REVIEW`/`ESCALATED`. It does **not** check
  order delivery status at all. Release is via `releaseEscrow()`, which
  uses an atomic conditional `updateMany` (`status: "HOLDING"` guard) to
  prevent double-release races — this part is already correct.
- `shippo-webhook.controller.ts`'s delivery handler is supposed to
  _tighten_ `releaseAfter` to `now + ESCROW_AUTO_RELEASE_DAYS` (config,
  default 5) once a carrier delivery webhook fires — but it's guarded by
  `if (!order.escrow.releaseAfter)`, and `releaseAfter` is never null
  (creation always sets it), so **this code path never executes**. A
  stale `// TODO: register a scheduled job to auto-release escrow...`
  comment sits right above it, apparently left over from before the cron
  in the previous bullet was added.
- `PayoutsService` (`apps/backend/src/modules/payouts/payouts.service.ts`)
  is a real, mostly-complete downstream pipeline, not a stub:
  - `schedulePayouts()` (daily cron) — finds `RELEASED` escrows 7+ days
    old with `order.status` in `DELIVERED`/`COMPLETED` and no active
    dispute, creates `Payout` rows (fee deducted, minimum-payout
    threshold, legacy-payout dedup).
  - `processPendingPayouts()` (daily cron) → `processPayout()` — actually
    calls Stripe Connect `transfers.create` or Paystack transfer, with
    idempotency keys, a new-seller hold, and per-provider validation.
  - `reconcileStuckPayouts()` (daily cron) — un-sticks payouts stuck in
    `PROCESSING` >1h by checking provider status, resets to `PENDING` for
    retry after 24h.
  - Stripe/Paystack webhook handlers mark `PAID`/`FAILED`, with one
    automatic retry (`retryCount < 1`) before permanent `FAILED`.
  - `releaseEscrow()`'s log line — _"[PAYOUT PENDING] ... must be
    triggered via payment provider. Integrate Stripe Connect transfer or
    equivalent before going live."_ — is stale. Money does move
    automatically; the comment predates this pipeline.
- Gaps confirmed by reading, not assumed:
  - No buyer-facing delivery confirmation. The only way `Order.status`
    reaches `DELIVERED` is the Shippo carrier webhook or a generic
    admin/seller status-update call. If an order has no tracking, or the
    webhook is missed, there's no self-service path to delivery
    confirmation at all today.
  - `PayoutsController` has `admin/process` (requires the payout to
    already be `PENDING`) and `admin/schedule`, but nothing to move a
    permanently `FAILED` payout back to `PENDING` — that requires direct
    database access today.
  - `apps/backend/src/telemetry/metrics.ts` has zero escrow/payout
    instrumentation. It does, however, already define a generic
    `backgroundJobsProcessed` Counter (`labelNames: ["job", "status"]`)
    that nothing currently uses for this — reusable as-is.
  - `PayoutsService.processPayout()` transitions `PENDING` → `PROCESSING`
    via a plain `prisma.payout.update()`, not an atomic conditional
    update the way `releaseEscrow()` guards its own state transition.
    Provider-side idempotency keys likely prevent an actual double
    transfer if two backend replicas raced here, but the database-level
    race itself isn't guarded.

## Amendment (found while writing the implementation plan)

The claim above — "no buyer-facing delivery confirmation exists" — was
wrong, and tracing the correction surfaced a real duplication bug:

- `POST /orders/:id/release` (`orders.controller.ts:153`) already lets
  the buyer release escrow immediately, at their sole discretion, any
  time (no delivery confirmation, no waiting period). It transitions the
  order to `COMPLETED`, which `OrdersService.updateStatus()` handles by
  calling a private `handleEscrowRelease()` method.
- `handleEscrowRelease()` (`orders.service.ts:1215`) is a **separate,
  duplicate implementation** of the escrow-release state transition —
  its own atomic conditional `updateMany`, its own `EscrowTransaction`
  creation — instead of calling `EscrowService.releaseEscrow()`. This is
  exactly the duplication the roadmap's RR-013 acceptance criteria
  warns against ("reuse the established escrow release service path; do
  not duplicate transfer or state-transition logic").
- `handleEscrowRelease()`'s release guard is `status: { in: [HOLDING,
DISPUTED] }` — unlike every other release path in this system (the
  cron, the admin manual-release endpoint), it will release an escrow
  that has an **open dispute**.

This does not change the core release-window bug fix (section 1 below,
still needed for the automatic/cron path). It does change decisions 3
and adds two new ones, confirmed in this session:

7. **Keep the new buyer "confirm delivery, start the countdown"
   endpoint**, but reframe it: it is not the only buyer self-service
   path (the existing immediate-release endpoint already is one) — it's
   a _passive_ option for buyers who'd rather let the dispute window run
   than actively hit "release now."
8. **Consolidate `handleEscrowRelease()` to call
   `EscrowService.releaseEscrow()`** instead of duplicating the release
   transition. In scope for this plan, not a follow-up — same release
   path this spec already modifies.
9. **Block buyer-initiated release while a dispute is open**, matching
   every other release path. `handleEscrowRelease()`'s guard becomes
   `status: HOLDING` only (via delegating to `releaseEscrow()`, which
   already only accepts `HOLDING`) — a buyer with an open dispute must
   resolve or withdraw it first, not have it silently superseded.

## Decisions made (this brainstorming session)

1. **Eligibility rule: delivery-gated, no fallback timer.** Escrow can
   only auto-release after delivery is confirmed (by either the Shippo
   webhook or the new buyer confirmation endpoint below), followed by the
   `ESCROW_AUTO_RELEASE_DAYS` dispute window. An order that's never
   confirmed delivered stays `HOLDING` indefinitely, resolvable only by
   admin action (existing `POST /escrow/order/:orderId/release` or
   `/refund`, both admin/moderator-only already). No generous backstop
   timer that releases funds without delivery confirmation.
2. **Scheduler: keep the existing cron/DB-sweep pattern.** Every other
   scheduled job in this backend (auction-end, account-deletion, escrow
   release, all four payout crons) already uses `@nestjs/schedule`
   cron-based sweeps; BullMQ is installed but only used for the
   moderation queue. A sweep is also self-healing after downtime by
   construction — a missed hourly tick is caught by the next one — which
   satisfies the roadmap's "recover missed jobs after downtime"
   requirement without new machinery. No BullMQ migration for this.
3. **Add a buyer "confirm receipt" endpoint.** Closes the gap created by
   decision 1: without it, any order without carrier tracking (or a
   missed webhook) would have no path to release at all.
4. **Add an admin retry-failed-payout endpoint.** Matches the roadmap's
   "operators can identify and safely retry failed releases" acceptance
   criterion directly.
5. **Add escrow/payout metrics using the existing unused
   `backgroundJobsProcessed` counter.** No new metric types.
6. **Fix the `processPayout()` race** to mirror `releaseEscrow()`'s
   atomic conditional-update pattern, in scope for this spec (not a
   separate follow-up) — it's directly covered by RR-013's "idempotent
   and concurrency-safe across multiple backend replicas" acceptance
   criterion.

## Design

### 1. Release-window fix (the core bug)

`EscrowService.createEscrowHolding()`: remove the `releaseAfter: new
Date(Date.now() + 14 * 24 * 60 * 60 * 1000)` line — leave it unset
(`releaseAfter DateTime?` is already nullable in the schema; no
migration).

Extract the "start the release countdown" logic currently inlined in
`shippo-webhook.controller.ts` (lines ~223–243) into a single shared
method, e.g. `EscrowService.startReleaseCountdown(orderId)`:

- No-ops if the escrow doesn't exist, isn't `HOLDING`, or already has a
  `releaseAfter` set (idempotent — safe to call from multiple triggers).
- Sets `releaseAfter = now + ESCROW_AUTO_RELEASE_DAYS days`.
- Ensures `Order.status` is `DELIVERED` (sets it + `deliveredAt` +
  timeline event if not already `DELIVERED`/`COMPLETED`), matching the
  webhook's existing behavior.

The Shippo webhook handler calls this method instead of its inlined
now-dead logic. Remove the stale TODO comment above it.

### 2. Buyer "confirm receipt" endpoint

`POST /orders/:orderId/confirm-delivery`, `JwtAuthGuard`, buyer-only
(must be `order.buyerId === req.user.id`). Valid only from an
order status where delivery is plausible (`FULFILLED` or `DELIVERED` —
reject otherwise with a clear error, e.g. can't confirm delivery on an
order that hasn't shipped). Calls the same
`EscrowService.startReleaseCountdown(orderId)` from section 1 — no
duplicated logic between the carrier-webhook path and the buyer
self-report path. Returns the updated order/escrow state. Add an
`OrderTimelineEvent` noting buyer self-confirmation (distinct wording
from the carrier-webhook-confirmed event, for audit clarity).

### 3. Explicit delivery filter in the sweep

`autoReleaseExpiredEscrows()`'s query gains `order: { status: { in:
["DELIVERED", "COMPLETED"] } }` alongside the existing `status:
HOLDING`, `releaseAfter: { lte: now }`, and no-active-dispute filters.
Redundant with decision 1 in practice (since `releaseAfter` is now only
ever set post-delivery) but makes the eligibility rule legible directly
from the query, and guards against any future code path that might set
`releaseAfter` without going through `startReleaseCountdown`.

### 4. Admin retry-failed-payout endpoint

`POST /payouts/admin/:payoutId/retry`, `JwtAuthGuard` + `RolesGuard` +
`@Roles("ADMIN")`. Validates the payout is currently `FAILED` (400
otherwise). Resets `status: PENDING`, clears `failureReason`, does
**not** reset `retryCount` (preserves the failure history — an operator
retrying a payout that already failed its one automatic retry should be
visible in the record). Writes an audit-log entry identifying the admin
actor. The next `processPendingPayouts()` tick picks it up through the
existing, unmodified path — no new payout-processing logic.

### 5. Metrics

Instrument existing methods with the existing `backgroundJobsProcessed`
counter — no changes to `apps/backend/src/telemetry/metrics.ts`:

- `autoReleaseExpiredEscrows()`: `{ job: "escrow_auto_release", status:
"released" }` per success, `{ status: "failed" }` per per-escrow
  failure in the existing try/catch.
- `schedulePayouts()`: `{ job: "payout_schedule", status: "created" }`
  per payout row created, `{ status: "skipped_below_minimum" }` /
  `{ status: "skipped_legacy_conflict" }` for the existing skip branches.
- `processPayout()`: `{ job: "payout_process", status: "succeeded" }` /
  `{ status: "failed" }`.
- The admin retry endpoint (section 4): `{ job: "payout_process", status:
"retried" }`.

### 6. `processPayout()` concurrency fix

Replace the plain `prisma.payout.update({ data: { status: PROCESSING }
})` with an atomic conditional update mirroring `releaseEscrow()`:

```ts
const claimed = await this.prisma.payout.updateMany({
  where: { id: payoutId, status: PayoutStatus.PENDING },
  data: { status: PayoutStatus.PROCESSING },
});
if (claimed.count === 0) {
  throw new BadRequestException(`Payout is not PENDING`);
}
```

This makes "PENDING → PROCESSING" itself the race-safe checkpoint,
consistent with how `releaseEscrow()` already guards `HOLDING →
RELEASED`. Only one concurrent caller can win the claim; the loser gets
a clean rejection instead of both proceeding to call the payment
provider.

### 7. Consolidate `handleEscrowRelease()` into `EscrowService.releaseEscrow()`

`OrdersService.handleEscrowRelease()` (`orders.service.ts:1215`)
currently duplicates the atomic release transition and
`EscrowTransaction` creation inline, inside the same Prisma
transaction (`tx`) that `updateStatus()` uses for the order update
itself, and releases from `HOLDING` **or** `DISPUTED`.

`handleEscrowRelease()` currently runs inside `updateStatus()`'s own
`prisma.$transaction(async (tx) => ...)` block, so the escrow release
and the order's transition to `COMPLETED` commit atomically together
today. Simply calling `releaseEscrow()` (which opens its own separate
transaction via `this.prisma`) before or after `updateStatus()`'s
transaction would lose that atomicity — a real regression risk: if the
order-status update failed after a successful release, the escrow would
be stuck `RELEASED` on a non-`COMPLETED` order, a new inconsistent state
that isn't reachable today.

Instead, give `EscrowService.releaseEscrow()` an optional transaction
client parameter, defaulting to `this.prisma` for its existing standalone
callers (the admin manual-release endpoint, the auto-release cron):

```ts
async releaseEscrow(
  orderId: string,
  actorId: string,
  note?: string,
  client: Prisma.TransactionClient | PrismaService = this.prisma,
) { /* body unchanged except using `client` instead of `this.prisma` */ }
```

`handleEscrowRelease()`'s body is replaced with a call to
`this.escrowService.releaseEscrow(order.id, dto.actorId, dto.note, tx)`,
passing its own `tx` through — preserving atomicity with the order
update, while going through the single real implementation instead of a
duplicate. Requires injecting `EscrowService` into `OrdersService`. Confirmed no
circular-dependency risk: `EscrowModule` imports only `PrismaModule` and
`NotificationsModule`, nothing from `orders` — `OrdersModule` just needs
`EscrowModule` added to its own `imports` array, no `forwardRef()`
needed.

`releaseEscrow()` only accepts `status: HOLDING`, so this also delivers
decision 9 (blocking release while disputed) as a side effect of
removing the duplicate `DISPUTED` branch — no separate code change
needed for that decision.

### 8. Cleanup

Remove the stale `[PAYOUT PENDING] ... Integrate Stripe Connect
transfer or equivalent before going live` log line in `releaseEscrow()`
— replace with a factual log noting the payout will be scheduled by
`PayoutsService` per its normal cadence.

## Testing

- Unit tests for `startReleaseCountdown`: no-ops on missing/non-HOLDING
  escrow, no-ops if `releaseAfter` already set (idempotency), correctly
  sets `releaseAfter` and transitions order status on the happy path.
- Unit tests for the buyer confirm-delivery endpoint: rejects
  non-buyers, rejects orders in an invalid status, succeeds and reaches
  the same state as the webhook path.
- Unit test proving `autoReleaseExpiredEscrows()` does **not** release
  an escrow whose order was never marked `DELIVERED` (this is the
  regression test for the bug this spec fixes) even if `releaseAfter`
  were somehow set (defense in depth for decision 3's filter).
- Concurrency test for the `processPayout()` fix: two simulated
  concurrent calls against the same `PENDING` payout — exactly one
  succeeds in claiming it, the other gets the rejection.
- Unit tests for the admin retry endpoint: rejects non-`FAILED`
  payouts, correctly resets state, preserves `retryCount`.
- Metrics: assert the counter is incremented with the right labels on
  each success/failure/skip branch touched above.
- Unit/integration test proving `POST /orders/:id/release` now rejects
  (400) when the escrow has an open dispute — this is the regression
  test for decision 9, and it must fail against the current code
  (`DISPUTED` is currently accepted) before the fix and pass after.
- Test proving `handleEscrowRelease()`'s order-status transaction and
  the escrow release still commit atomically together (e.g. simulate
  the order-update step failing after `releaseEscrow()` succeeds inside
  the same `tx`, and confirm the whole transaction rolls back — the
  escrow must not end up `RELEASED` on a non-`COMPLETED` order).

## Explicitly out of scope

- Making Stripe Connect / Paystack transfer calls themselves more
  robust beyond the existing retry-once-then-fail behavior (e.g.
  multi-attempt backoff schedules) — the existing retry design is
  unchanged by this spec.
- A buyer-facing UI for the new confirm-delivery endpoint — this spec
  covers the backend endpoint only; a follow-up ticket covers the web
  UI button.
- GHS/KES Paystack transfer-recipient verification (tracked separately
  in RR-022, per the roadmap's open decisions).

## Approval

Per `.assistant/rules/protected-paths.md`, this spec requires explicit,
scoped approval from the Project Owner before any implementation
begins, per the specific changes described above (escrow release logic,
new buyer/admin endpoints, payout state-transition change). Approval is
scoped to this spec's content — a later change to escrow/payout
behavior needs its own approval.
