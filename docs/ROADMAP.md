# Roadmap

## Release-readiness remediation backlog

Audit baseline: **2026-08-22**

Target capability: a reproducible, bootable, transaction-safe Forumo release whose web, admin, mobile, backend, shared packages, and deployment configuration pass the documented quality gates from a clean checkout.

### Minimum viable public-beta checklist

For this roadmap, **viable** means a web-first public beta can accept real users and money without relying on demo authentication, silent provider mocks, unverified fund movement, or operator guesswork. Native mobile availability is a separate launch-scope decision: it is not required for a web-first beta, but it becomes a blocker if mobile is advertised at launch.

| Gate                                  | Current evidence                                                                                                                                                          | Work still required before launch                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducible engineering baseline     | pnpm `11.19.0`, frozen-lockfile installation, root verification, deterministic Prisma postinstall, Node `22.23.2` pinned. RR-001 complete.                                | RR-002: Add Prisma lifecycle/CI drift check. RR-003: Fix design-system Storybook type boundary.                                                       |
| Authentication and environment safety | Backend authentication tests and builds pass. RR-010 through RR-012 not started.                                                                                          | RR-010: Normalize web API base URL. RR-011: Fix Google OAuth routing. RR-012: Make Docker stack bootable and honest. RR-020: Remove mobile demo auth. |
| Money movement and order lifecycle    | Unit/integration suites cover payments, payouts, escrow, orders, auctions, and webhook rejection paths. Escrow auto-release uses `@nestjs/schedule` cron, 14-day default. | RR-013: Safe escrow auto-release (requires ABADO approval, 5-day window). RR-022: Provider sandbox verification (Stripe, Paystack, Shippo).           |
| Buyer/seller web journey              | Web type-check, tests, and production build pass.                                                                                                                         | Browser E2E for auth, checkout, disputes, reviews, seller payout, session refresh.                                                                    |
| Admin and trust operations            | Admin type-check and production build pass; 6 pages wired (KYC, moderation, users, listings, disputes, analytics).                                                        | Role/authorization E2E tests, operational owners, SLAs, escalation procedures.                                                                        |
| Production deployment and recovery    | Kubernetes deployment, rollback, monitoring, and environment guidance is documented.                                                                                      | Staging deployment rehearsal, migration rehearsal, backup/restore, readiness/rollback smoke test, alert verification, secret/config review.           |
| Security and compliance               | Two upstream-unfixed `image-size` advisories locally patched and regression-tested.                                                                                       | Triage remaining 9 low / 24 moderate advisories. Secret scanning, SAST, container scans, CI enforcement.                                              |
| Mobile launch path                    | 27 screens implemented and navigation-wired. Direct API calls, no tests, unverified E2E.                                                                                  | RR-020: Remove demo auth. RR-021: Device-safe API config. RR-023: Mobile critical paths against live backend. Not required for web-first beta.        |

#### Ordered launch todo list (sequential phases)

**Phase 0** (RR-002 → RR-003):

1. [x] Add Prisma lifecycle/CI drift check (RR-002). ✅ Done
2. [x] Fix design-system Storybook type boundary (RR-003). ✅ Done

**Phase 1** (RR-010 → RR-011 → RR-012 → RR-013): 3. [x] Normalize web API base URL via canonical helper (RR-010). ✅ Done 4. [x] Fix Google OAuth routing — Google OAuth removed, replaced with magic link (RR-011). ✅ Done 5. [x] Make Docker stack bootable with env var secrets (RR-012). ✅ Done 6. [x] Implement safe escrow auto-release with ABADO approval (RR-013, 5-day window). ✅ Done — cron-based processor with eligibility checks, reconciliation, audit trail, concurrency safety

**Phase 2** (RR-020 → RR-021 → RR-022 → RR-023): 7. [ ] Remove mobile demo auth completely (RR-020) 8. [ ] Make mobile API configuration device-safe (RR-021) 9. [ ] Verify all supported payment/shipping providers in sandbox (RR-022) 10. [ ] Test mobile critical paths against live backend (RR-023)

**Phase 3** (RR-030 → RR-031 → RR-032 → RR-033): 11. [ ] Full automated verification pipeline — all root commands pass (RR-030) 12. [ ] Burn down lint warnings to zero (RR-031) 13. [ ] Add release smoke tests and operational evidence (RR-032) 14. [ ] Reconcile documentation with verified behavior (RR-033) 15. [ ] Produce release-candidate evidence bundle with commit SHA, test results, provider runs, and named approvers

#### Product and operating decisions (all resolved 2026-09-18)

- [x] **Web-only vs mobile:** web-first beta. Mobile is not required for launch but must be completed if advertised.
- [x] **Supported markets:** USD/EUR/GBP (Stripe) and NGN (Paystack). GHS/KES payouts marked "unverified" — not launch-critical.
- [x] **Escrow scheduler:** `@nestjs/schedule` cron jobs (not BullMQ). 5-day fixed window, configurable via `ESCROW_AUTO_RELEASE_DAYS`.
- [x] **Mobile demo mode:** removed completely from all builds. Dev-only feature flag only.
- [x] **Local integrations:** explicit disabled adapters. Missing integrations log warnings in dev, fail closed in production.
- [x] **Coverage scope:** backend + shared hit 80% immediately. Web/admin/mobile follow in Phase 3.

#### Remaining decisions to make

- [ ] Who owns KYC review, listing moderation, fraud response, disputes, refunds, payout failures, and after-hours incidents, and what are their response-time targets?
- [ ] Which legal entity, terms, privacy policy, prohibited-items policy, returns policy, KYC/AML obligations, tax obligations, and data-retention rules apply in each launch market?
- [ ] What launch thresholds block or roll back a release: payment failure rate, webhook backlog, 5xx rate, auth-refresh failure, queue depth, unresolved high-risk disputes, or another metric?

### Priority and status legend

| Marker | Meaning                                                                               |
| ------ | ------------------------------------------------------------------------------------- |
| P0     | Release blocker, security issue, or risk to authentication/payment/escrow correctness |
| P1     | Required before public launch, but can follow the P0 stabilization work               |
| P2     | Quality, maintainability, and operational hardening                                   |
| `[ ]`  | Not started                                                                           |
| `[-]`  | In progress                                                                           |
| `[x]`  | Verified complete                                                                     |

### Fixed constraints

- Do not modify the escrow or auction state machines without explicit approval and an architecture review.
- Payment, payout, webhook, and escrow work must be idempotent, concurrency-safe, and covered by unit and integration tests before merge.
- Never place real provider credentials or reusable secrets in source control. Production must fail closed when required secrets are absent.
- Use Prisma schema and generated types as the backend data-model source of truth.
- Keep `NEXT_PUBLIC_USE_API_MOCKS=false` in production, and prevent demo authentication from entering production builds.
- Preserve the standard API envelope and shared `ForumoApiClient` contract.
- Every behavior change follows TDD and must leave the affected package with meaningful unit/integration coverage; overall target remains 80%+.

### Phase 0 — Restore a reproducible engineering baseline

#### RR-001 — Enforce the supported Node and pnpm toolchain (P0)

- [x] Migrate the repository to pnpm `11.19.0` so local, CI, container, and Codex verification use the same package-manager major.
- [x] Pin Node `22.23.2` in `.node-version` and align server/web CI and deployment images with it.
- [x] Use the root `packageManager` declaration as the pnpm source for local Corepack and CI setup.
- [x] Complete the pnpm 11 migration; the pnpm 9 compatibility branch is no longer applicable.
- [x] Migrate overrides and patched dependencies to `pnpm-workspace.yaml`, the supported pnpm 11 configuration surface.
- [x] Add a CI preflight that prints and validates Node/pnpm versions before installation.

Dependencies: none.

Acceptance criteria:

- A clean checkout runs `pnpm install --frozen-lockfile` without purging an incompatible modules directory or prompting for input.
- `pnpm --version` matches the repository decision.
- Security overrides and the Expo CLI patch are demonstrably applied.
- CI and local setup use the same major Node and pnpm versions.

Verification:

```bash
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm list --depth 0
```

#### RR-002 — Make Prisma generation deterministic (P0)

- [ ] Confirm `prisma` and `@prisma/client` use compatible, intentionally pinned versions.
- [ ] Run generation from `apps/backend/prisma/schema.prisma` and confirm the generated client exports all schema models and enums.
- [ ] Add or repair a package lifecycle/CI step so a clean install cannot type-check or build against an ungenerated client.
- [ ] Add a CI drift check that fails when the schema and generated client are inconsistent.
- [ ] Document when developers must run `prisma generate`, including after branch switches that change the schema.

Dependencies: RR-001.

Acceptance criteria:

- `PrismaClient`, `Prisma`, model delegates, and schema enums resolve in the backend.
- Backend type-check completes without the current cascading missing-Prisma errors.
- Backend tests reach test execution instead of failing during TypeScript compilation.

Verification:

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend typecheck
pnpm --filter backend test
```

#### RR-003 — Repair the design-system type boundary (P1)

- [ ] Decide whether Storybook stories are part of the package type-check or have a separate Storybook tsconfig.
- [ ] Add the correct direct Storybook type dependency or update story imports to the supported package API.
- [ ] Add design-system `typecheck`, `test`, and Storybook build tasks to Turbo/CI if they are intended release surfaces.

Dependencies: RR-001.

Acceptance criteria:

- All four `*.stories.tsx` files resolve their Storybook types.
- `pnpm --filter @forumo/design-system typecheck` passes from a clean install.

### Phase 1 — Fix release-blocking runtime paths

#### RR-010 — Normalize the web API base URL contract (P0)

- [ ] Define one canonical meaning for `NEXT_PUBLIC_API_BASE_URL`: either origin-only or already versioned with `/api/v1`.
- [ ] Centralize URL joining so callers cannot duplicate or omit the version prefix.
- [ ] Fix NextAuth token refresh, which currently combines the documented `/api/v1` base with another `/api/v1/auth/refresh` suffix.
- [ ] Audit OAuth, server actions, shared client creation, WebSocket setup, and admin client construction for the same class of duplication.
- [ ] Reject malformed base URLs at startup/build time with a clear error.

Dependencies: RR-001.

Acceptance criteria:

- With `.env.example`, refresh requests target exactly `/api/v1/auth/refresh`.
- Local, test, and production configurations follow the same URL rule.
- No authentication flow constructs backend URLs independently of the canonical helper.

Tests:

- Unit tests for base URLs with/without trailing slashes and version prefixes.
- NextAuth refresh success, provider failure, expired refresh token, and malformed-response tests.
- Browser test proving an expired access token refreshes without logging the user out.

#### RR-011 — Correct Google OAuth routing and fallbacks (P0)

- [ ] Replace the web Google sign-in fallback from admin port `3001` to the canonical backend OAuth endpoint.
- [ ] Prefer the normalized API URL helper from RR-010 over a component-local fallback.
- [ ] Validate local and production callback URLs against the Google provider configuration.
- [ ] Confirm failure/cancellation redirects return to a safe web route with a user-facing error.

Dependencies: RR-010.

Acceptance criteria:

- The web sign-in button always starts OAuth on the backend, never the admin app.
- Callback state/nonce handling remains validated.
- Login works with configured credentials; missing credentials produce an intentional disabled/error state.

#### RR-012 — Make the Docker development stack bootable and honest (P0)

- [ ] Reconcile backend environment validation with the values supplied by `docker-compose.yml`.
- [ ] Remove hard-coded reusable secrets from Compose; load development-only values through a git-ignored `.env` or an explicit safe bootstrap path.
- [ ] Decide which integrations are mandatory for local startup and which may be disabled behind explicit feature/config flags.
- [ ] Make disabled Stripe, Paystack, Shippo, email, SMS, and OAuth capabilities visible in health/readiness output.
- [ ] Never silently return payment success from mock providers unless an explicit development mock flag is enabled.
- [ ] Add Compose health checks that prove backend readiness, not merely that the container process exists.

Dependencies: RR-001, RR-002.

Acceptance criteria:

- `docker compose up` reaches healthy state using documented development configuration.
- Production configuration still fails fast when required payment/webhook secrets are missing.
- A developer can tell from logs and health output which external integrations are disabled.
- No real or reusable provider secret is committed.

Tests:

- Config-schema tests for development, test, and production matrices.
- Compose smoke test for Postgres, Redis, MinIO, moderation service, backend, web, and admin health.

#### RR-013 — Implement safe escrow auto-release execution (P0, protected workflow)

- [ ] Obtain explicit approval before modifying escrow behavior.
- [ ] Architecture review: choose a durable BullMQ delayed job, periodic database sweep, or both with reconciliation.
- [ ] Define the exact eligibility predicate: holding status, delivery confirmed, `releaseAfter <= now`, no open dispute, no refund/reversal, and seller payout eligibility.
- [ ] Make execution idempotent and concurrency-safe across multiple backend replicas.
- [ ] Reuse the established escrow release service path; do not duplicate transfer or state-transition logic in the scheduler.
- [ ] Persist an audit trail identifying automatic release as the actor/reason.
- [ ] Add retry/backoff and a dead-letter/operator-recovery path for provider failures.
- [ ] Emit structured logs, metrics, and alerts for due, released, skipped, retried, and permanently failed releases.
- [ ] Add a startup/reconciliation scan so missed delayed jobs are recovered after downtime.
- [ ] Ensure an opened dispute cancels or invalidates pending automatic release.

Dependencies: RR-002 and explicit escrow architecture approval.

Acceptance criteria:

- Every eligible expired hold is eventually processed exactly once from the business perspective.
- Disputed, refunded, already released, or not-yet-due holds never release.
- Provider timeout/retry cannot create duplicate payouts.
- Operators can identify and safely retry failed releases.

Tests:

- Unit tests for every eligibility branch and time boundary.
- Integration tests with concurrent workers attempting the same release.
- Recovery tests for backend downtime, job loss, provider timeout, and partial failure.
- End-to-end delivered-order scenarios for manual confirmation, automatic release, and dispute-before-deadline.

### Phase 2 — Complete client and commerce integration

#### RR-020 — Remove unsafe mobile authentication behavior (P0)

- [ ] Remove the unconditional demo-login path or gate it behind an explicit development-only build flag.
- [ ] Ensure demo tokens/users cannot be persisted in production builds.
- [ ] On app hydration, validate/refresh stored credentials before rendering authenticated navigation.
- [ ] Clear invalid sessions atomically and show a useful re-authentication message.
- [ ] Add secure-token storage review for access and refresh tokens.

Dependencies: RR-010.

Acceptance criteria:

- The app never appears authenticated with `demo-access-token` outside explicit development mode.
- Invalid/expired tokens route to login rather than causing a stream of failed API requests.
- Production build validation fails if demo auth is enabled.

#### RR-021 — Make mobile API configuration device-safe (P1)

- [ ] Replace the physical-device `localhost` default with environment/profile configuration.
- [ ] Document Android emulator, iOS simulator, physical LAN device, staging, and production base URLs.
- [ ] Normalize the mobile API base contract with web/admin/shared clients.
- [ ] Add an in-app development diagnostic showing environment, API origin, and backend health without exposing secrets.

Dependencies: RR-010, RR-020.

Acceptance criteria:

- A physical device can reach the backend using documented configuration.
- Release builds have no localhost API fallback.
- Misconfiguration produces a clear connectivity error.

#### RR-022 — Verify payment and shipping providers end-to-end (P1)

- [ ] Define supported currency/provider combinations and explicitly mark unverified Paystack transfer-recipient types for GHS/KES.
- [ ] Exercise Stripe PaymentIntent, Stripe Connect onboarding/payout, Paystack charge/verify/transfer, refund, and webhook flows in provider test modes.
- [ ] Exercise Shippo label purchase, tracking update, delivery webhook, and signature rejection flows.
- [ ] Verify webhook replay/idempotency across every provider.
- [ ] Verify raw-body preservation and signature validation in deployed ingress/runtime configuration.
- [ ] Replace silent integration degradation with explicit capability status and actionable errors.
- [ ] Write reconciliation runbooks for provider success with local failure and local success with delayed provider events.

Dependencies: RR-012, RR-013 for the delivered-order auto-release scenario.

Acceptance criteria:

- Each supported provider/currency path has a recorded passing sandbox E2E result.
- Invalid webhook signatures are rejected before business logic.
- Retried webhook events do not duplicate orders, refunds, transfers, or payouts.
- Unsupported currency/bank combinations fail before funds are accepted.

#### RR-023 — Verify the mobile critical path against a live backend (P1)

- [ ] Cover register/login/refresh/logout.
- [ ] Cover browse/search/listing detail and media loading.
- [ ] Cover cart variants, checkout, payment handoff, and order status.
- [ ] Cover offers, auctions/live updates, messaging, push notification routing, KYC, reviews, and seller flows.
- [ ] Replace ad hoc screen-level API error handling with consistent retry/error/session-expiry behavior.

Dependencies: RR-020, RR-021, RR-022.

Acceptance criteria:

- Critical mobile flows pass on at least one Android emulator/device and one iOS simulator/device.
- Results are reproducible in CI where feasible and documented where provider/device testing remains manual.

### Phase 3 — Quality and release gates

#### RR-030 — Restore the full automated verification pipeline (P0)

- [ ] Make root `typecheck`, `lint`, `test`, `test:e2e`, and `build` executable from a clean checkout.
- [ ] Add all workspace packages, including design system and moderation service, to appropriate CI gates.
- [ ] Require Prisma generation before backend compilation.
- [ ] Separate environment/sandbox failures from genuine test failures in CI reporting.
- [ ] Publish package-level test counts and coverage.
- [ ] Enforce the 80% coverage target on agreed critical packages and prevent regression.

Dependencies: RR-001, RR-002, RR-003, and behavior-specific test work.

Acceptance criteria:

- All required root commands pass in CI without interactive prompts.
- Backend has zero compile-blocked suites.
- Web, admin, mobile, shared, backend, design system, deployment configuration, and moderation checks report independently.

#### RR-031 — Burn down warning debt (P1)

- [ ] Triage the current backend lint warnings, prioritizing explicit `any`, unsafe values, and unused security/payment code.
- [ ] Fix React hook dependency warnings based on data-flow correctness, not blanket suppression.
- [ ] Replace unoptimized `<img>` usage where Next Image is appropriate, documenting deliberate exceptions.
- [ ] Remove unused mobile values/imports and verify effects do not capture stale auth/API state.
- [ ] Establish a no-new-warnings CI policy, then ratchet existing warning baselines to zero.

Dependencies: RR-030 can proceed in parallel after toolchain stabilization.

Acceptance criteria:

- No warning hides a correctness or security problem.
- New changes cannot increase warning counts.
- Target end state is zero lint warnings in every maintained workspace.

#### RR-032 — Add release smoke tests and operational evidence (P1)

- [ ] Create a deterministic smoke suite covering health/readiness, auth refresh, listing browse, checkout initiation, webhook rejection, messaging connection, admin authorization, and mobile API reachability.
- [ ] Verify production build-time `NEXT_PUBLIC_*` variables are present and mocks are disabled.
- [ ] Verify migrations before rollout and readiness before traffic.
- [ ] Add dashboard/alert checks for auth refresh failure, payment webhook failure, escrow release failure, queue backlog, and 5xx rate.
- [ ] Store test evidence with the release candidate: commit SHA, environment, commands, counts, coverage, and provider sandbox runs.

Dependencies: RR-010 through RR-031 as applicable.

Acceptance criteria:

- A release candidate has a single auditable readiness report.
- Failed smoke tests block promotion.
- Rollback triggers and owner actions are explicit.

#### RR-033 — Reconcile documentation with verified behavior (P2)

- [ ] Update `CLAUDE.md` production-readiness claims to match verified builds/tests rather than intended status.
- [ ] Update testing commands after finalizing the package-manager and Prisma bootstrap workflows.
- [ ] Document canonical API URL semantics once RR-010 is complete.
- [ ] Document local integration-disabled behavior and production-required secrets.
- [ ] Record escrow auto-release architecture, recovery, and operator runbook after approval and implementation.
- [ ] Mark roadmap items complete only when their acceptance criteria and verification evidence exist.

Dependencies: completed implementation work.

### Recommended execution order (sequential — all phases)

**Phase 0 → Phase 1 → Phase 2 → Phase 3.** Each phase must pass all acceptance criteria before the next begins.

1. **Phase 0** — RR-002 → RR-003: make results trustworthy (Prisma drift check, design-system types)
2. **Phase 1** — RR-010 → RR-011 → RR-012 → RR-013: fix auth, boot paths, escrow auto-release (RR-013 requires ABADO approval)
3. **Phase 2** — RR-020 → RR-021 → RR-022 → RR-023: secure mobile, verify providers, test mobile against live backend
4. **Phase 3** — RR-030 → RR-031 → RR-032 → RR-033: full CI pipeline, zero warnings, smoke tests, doc reconciliation

### Open decisions (RESOLVED)

- [x] **Toolchain:** migrate deliberately to pnpm 11.19.0. ✅ Complete (RR-001)
- [x] **Local integrations:** explicit disabled/test adapters supported. Missing external integrations must fail gracefully with logged warnings; production fails closed. Extend `NEXT_PUBLIC_USE_API_MOCKS` pattern.
- [x] **Escrow scheduler:** `@nestjs/schedule` cron jobs confirmed (not BullMQ). BullMQ installed but used only for Redis caching/rate limiting.
- [x] **Automatic release policy:** 5-day fixed window (updated from current 14-day default). Configurable per market via `ESCROW_AUTO_RELEASE_DAYS` env var.
- [x] **Mobile demo mode:** remove completely. No `demo-access-token` in any build. Replace with explicit dev-only feature flag gated behind build-time check.
- [x] **Supported markets:** USD/EUR/GBP (Stripe) and NGN (Paystack) only. GHS/KES seller payouts marked "unverified" — NOT a launch requirement.
- [x] **Coverage scope:** Backend + `@forumo/shared` must reach 80% immediately. Web/admin follow in Phase 3. Mobile not required for web-first beta.

### Overall definition of done (updated 2026-09-18)

- [ ] Clean-checkout install, type-check, lint, tests, E2E, and build pass using the enforced toolchain.
- [ ] Backend and Compose boot with documented configuration and truthful integration health.
- [ ] Auth refresh and Google OAuth pass browser E2E tests.
- [ ] Escrow automatic release is ABADO-approved, idempotent, dispute-safe, observable, and recovery-tested (5-day window).
- [ ] Supported payment/shipping flows have provider-sandbox evidence (USD/EUR/GBP/NGN only).
- [ ] Mobile critical paths pass against a real backend without demo authentication or localhost release defaults.
- [ ] CI enforces security scanning, 80%+ agreed coverage, and no regression in warnings.
- [ ] Release candidate smoke evidence and rollback instructions are complete.
- [ ] Zero demo auth in any build.
- [ ] All missing external integrations fail gracefully with logged warnings (dev) or fail closed (production).

## MVP (Weeks 0-10)

- [ ] Auth & User profiles (email/password, OTP, device logs)
- [x] Listings CRUD with media uploads + AI moderation webhooks
- [ ] Search (PostgreSQL full-text + filters)
- [ ] Orders + Escrow checkout (Stripe test mode)
- [ ] Messaging (1:1 chat, attachments, moderation flags)
- [ ] Reviews + trust score seed values
- [ ] Basic admin console (KYC queue, listing approvals, dispute view)
- [ ] React Native shell with browsing + messaging read-only

## V1 (Months 3-6 post-launch)

- [ ] Auctions engine (proxy bidding, anti-sniping, live updates)
- [ ] Inventory engine (reservations, bundles, alerts)
- [ ] Delivery integrations (Pargo, The Courier Guy)
- [ ] Push notifications (Expo + web push)
- [ ] Advanced admin analytics (PostHog, KPI dashboards)
- [ ] Payment reconciliation + payout approvals

## V2 (Months 6-12)

- [ ] Marketplace groups / community hubs
- [ ] Seller subscription tiers
- [ ] Wallet & stored balance
- [ ] AI dynamic pricing recommendations
- [ ] Crypto + multi-currency support
- [ ] Automated risk scoring + ML feedback loop

## Cross-cutting initiatives

| Theme         | Description                                                         |
| ------------- | ------------------------------------------------------------------- |
| Observability | OpenTelemetry, Grafana dashboards, SLOs.                            |
| Compliance    | POPIA + CPA + ECTA documentation, DPA checklists.                   |
| Security      | Pen-testing schedule, dependency scanning, secret rotation.         |
| QA Automation | Unit + integration coverage, Cypress suites, mobile snapshot tests. |
