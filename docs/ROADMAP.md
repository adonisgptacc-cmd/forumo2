# Roadmap

## Release-readiness remediation backlog

Audit baseline: **2026-08-22**

Target capability: a reproducible, bootable, transaction-safe Forumo release whose web, admin, mobile, backend, shared packages, and deployment configuration pass the documented quality gates from a clean checkout.

### Minimum viable public-beta checklist

For this roadmap, **viable** means a web-first public beta can accept real users and money without relying on demo authentication, silent provider mocks, unverified fund movement, or operator guesswork. Native mobile availability is a separate launch-scope decision: it is not required for a web-first beta, but it becomes a blocker if mobile is advertised at launch.

| Gate                                  | Current evidence                                                                                                                                      | Work still required before launch                                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducible engineering baseline     | pnpm `11.19.0`, frozen-lockfile installation, root verification, deterministic Prisma postinstall, and dependency regression tests pass locally.      | Pin/enforce Node, add CI toolchain and Prisma drift preflights, and prove the same commands from a clean CI checkout.                                                                                             |
| Authentication and environment safety | Backend authentication tests and builds pass.                                                                                                         | Complete RR-010, RR-011, RR-012, and RR-020: canonicalize API URLs, validate Google OAuth callbacks, remove/gate demo mobile auth, and make disabled integrations explicit.                                       |
| Money movement and order lifecycle    | Unit/integration suites cover payments, payouts, escrow, orders, auctions, and webhook rejection paths.                                               | Obtain the required escrow architecture approval; prove Stripe, Paystack, payout, refund, webhook replay, dispute, shipping, and auto-release scenarios in provider sandboxes.                                    |
| Buyer/seller web journey              | Web type-check, tests, and production build pass.                                                                                                     | Add browser E2E evidence for register/login, browse, listing creation, cart/checkout, payment, order fulfilment, dispute/refund, review, seller payout, and session refresh.                                      |
| Admin and trust operations            | Admin type-check and production build pass; KYC, moderation, users, listings, disputes, and analytics surfaces exist.                                 | Run role/authorization E2E tests and define operational owners, queues, SLAs, escalation paths, and recovery procedures for KYC, fraud, moderation, disputes, refunds, and payouts.                               |
| Production deployment and recovery    | Kubernetes deployment, rollback, monitoring, and environment guidance is documented.                                                                  | Perform a staging deployment, migration rehearsal, backup/restore test, readiness/rollback smoke test, alert verification, and production secret/config review.                                                   |
| Security and compliance               | No unmitigated high-severity dependency advisory remains; the two upstream-unfixed `image-size` advisories are locally patched and regression-tested. | Triage and remediate or formally accept the remaining 9 low and 24 moderate advisories; run secret, SAST, container, and dependency scans in CI; complete jurisdiction-specific legal/privacy/KYC/payment review. |
| Mobile launch path                    | Twenty-seven screens are implemented and navigation-wired.                                                                                            | If mobile is in beta scope, complete RR-021 and RR-023 on Android and iOS against staging, including secure token storage, push routing, payment handoff, and offline/error behavior.                             |

#### Ordered launch todo list

1. [ ] Close the reproducibility gaps in RR-001 through RR-003 and capture a clean-checkout CI run.
2. [ ] Close the authentication, URL, configuration, and demo-mode blockers in RR-010 through RR-012 and RR-020.
3. [ ] Decide the escrow scheduler/reconciliation design and automatic-release policy, then complete protected RR-013 with concurrency and recovery tests.
4. [ ] Define the exact launch markets, currencies, providers, shipping carriers, and web/mobile surfaces; disable unsupported combinations before accepting funds.
5. [ ] Complete provider-sandbox and webhook-replay evidence in RR-022 for every enabled commerce path.
6. [ ] Add the browser and API smoke suite in RR-032 for the critical buyer, seller, admin, and recovery journeys.
7. [ ] Rehearse staging deployment, migration, backup/restore, rollback, observability alerts, and operator runbooks.
8. [ ] Triage the remaining low/moderate dependency findings and make security, privacy, KYC, marketplace-policy, and data-retention sign-offs explicit.
9. [ ] If mobile is part of launch, complete device-safe configuration and Android/iOS critical-path validation in RR-021 and RR-023.
10. [ ] Produce a release-candidate evidence bundle containing the commit SHA, environment, test/build/coverage results, provider runs, known accepted risks, and named launch approvers.

#### Product and operating decisions still needed

- [ ] Is the first viable release web-only, or must Android and iOS ship with it?
- [ ] Which countries, currencies, payment/payout providers, and shipping services are enabled at launch?
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
- [x] Add an enforceable Node version declaration (`.nvmrc`, `.node-version`, Volta, or equivalent) aligned with CI and deployment images. (`.nvmrc` pins Node `22`. It was initially set to `20` to match the then-current Dockerfiles, but that combination was never actually verified — a real `docker compose up --build` later revealed pnpm `11.19.0` hard-requires Node ≥22.13 (`node:sqlite` built-in, added in Node 22.5), crashing under Node 20 in Docker with `ERR_UNKNOWN_BUILTIN_MODULE`. Corrected to Node `22`, and `apps/backend/Dockerfile`/`apps/web/Dockerfile` bumped from `node:20-slim` to `node:22-slim` to match (approved change, see RR-012).)
- [x] Ensure Corepack or the repository bootstrap path activates the exact `packageManager` version.
- [x] If remaining on pnpm 9, verify `pnpm.overrides` and `patchedDependencies` are honored. (N/A — repository is on pnpm 11.)
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

- [x] Confirm `prisma` and `@prisma/client` use compatible, intentionally pinned versions. (Both caret-pinned to `^5.20.0`, verified they resolve to the same `5.22.0` and typecheck cleanly.)
- [x] Run generation from `apps/backend/prisma/schema.prisma` and confirm the generated client exports all schema models and enums. (Verified via `tests/prisma-drift.test.mjs`.)
- [x] Add or repair a package lifecycle/CI step so a clean install cannot type-check or build against an ungenerated client. (`pretypecheck`/`pretest`/`prebuild` hooks in `apps/backend/package.json` already run `prisma:generate` first; confirmed working from a clean install.)
- [x] Add a CI drift check that fails when the schema and generated client are inconsistent. (`tests/prisma-drift.test.mjs`, run via `pnpm test:prisma-drift` in the CI `lint` job.)
- [x] Document when developers must run `prisma generate`, including after branch switches that change the schema.

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

- [x] Decide whether Storybook stories are part of the package type-check or have a separate Storybook tsconfig. (Kept in the existing single `tsconfig.json` — stories were already included via `src/**/*`; no split needed.)
- [x] Add the correct direct Storybook type dependency or update story imports to the supported package API. (Added `@storybook/react` as an explicit devDependency; it was only a transitive dep of `@storybook/react-vite`, which pnpm's strict linking hid from `tsc`.)
- [x] Add design-system `typecheck`, `test`, and Storybook build tasks to Turbo/CI if they are intended release surfaces. (Added `typecheck` script; it's picked up automatically by the existing `turbo run typecheck` used in root `pnpm typecheck`/CI `lint` job — no `turbo.json` change needed. The package has no test suite or release-surface Storybook build requirement yet, so those are left out of scope.)

Dependencies: RR-001.

Acceptance criteria:

- All four `*.stories.tsx` files resolve their Storybook types.
- `pnpm --filter @forumo/design-system typecheck` passes from a clean install.

### Phase 1 — Fix release-blocking runtime paths

#### RR-010 — Normalize the web API base URL contract (P0)

- [x] Define one canonical meaning for `NEXT_PUBLIC_API_BASE_URL`: either origin-only or already versioned with `/api/v1`. (`getApiBaseUrl()` in `packages/shared/src/api-client.ts` accepts either form and normalizes idempotently; both accepted forms are now unit-tested.)
- [x] Centralize URL joining so callers cannot duplicate or omit the version prefix. (`apps/admin` was constructing its own `ForumoApiClient` base URL directly from `process.env` with a different hardcoded default than `apps/web`, bypassing the shared helper — the one real duplication found. Fixed in `apps/admin/src/lib/api-client.ts` and `apps/admin/src/lib/auth.ts` to call `getApiBaseUrl()`.)
- [x] Fix NextAuth token refresh, which currently combines the documented `/api/v1` base with another `/api/v1/auth/refresh` suffix. (Verified this is already correct in the current tree — `apps/web/src/lib/auth.ts` builds `${getApiBaseUrl()}/auth/refresh`, which does not double the prefix. Likely already fixed by an earlier commit; the roadmap text describes the risk pattern, not a live bug.)
- [x] Audit OAuth, server actions, shared client creation, WebSocket setup, and admin client construction for the same class of duplication. (OAuth button, `messaging-layer.ts` WebSocket base, and web server actions (`apps/web/src/app/(admin)/admin/*/actions.ts`) all already route through `getApiBaseUrl()`/`getGatewayBaseUrl()` via `createApiClient()`. Admin client construction was the one gap; fixed above.)
- [ ] Reject malformed base URLs at startup/build time with a clear error. (Not done — `getApiBaseUrl()` silently normalizes any string rather than validating it's a well-formed URL. Left for a follow-up; out of scope for this bounded pass.)

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

- [x] Replace the web Google sign-in fallback from admin port `3001` to the canonical backend OAuth endpoint. (Verified: no port-3001 fallback exists in the current tree — `google-signin-button.tsx` links straight to the backend's `/auth/google`. Already fixed, likely by an earlier commit.)
- [x] Prefer the normalized API URL helper from RR-010 over a component-local fallback. (Verified: it already calls `getApiBaseUrl()`, no local fallback logic.)
- [ ] Validate local and production callback URLs against the Google provider configuration. (Requires comparing against the real Google Cloud Console OAuth client config, which needs operator access to actual credentials — out of scope for this pass.)
- [x] Confirm failure/cancellation redirects return to a safe web route with a user-facing error. (This was the real, verified bug: `GoogleAuthGuard` had no failure handling, so cancellation/failure produced a raw JSON 401 on the backend's own origin instead of a redirect. Fixed via `handleRequest` override in `apps/backend/src/modules/auth/guards/google-auth.guard.ts`, redirecting to `${FRONTEND_URL}/login?error=oauth_failed` — the same error param the frontend's `OAuthCallback` component already checks for. Added a `response.headersSent` guard in `all-exceptions.filter.ts` to prevent a double-response crash. Covered by `google-auth.guard.spec.ts`.)

Dependencies: RR-010.

Acceptance criteria:

- The web sign-in button always starts OAuth on the backend, never the admin app.
- Callback state/nonce handling remains validated.
- Login works with configured credentials; missing credentials produce an intentional disabled/error state.

#### RR-012 — Make the Docker development stack bootable and honest (P0)

- [x] Reconcile backend environment validation with the values supplied by `docker-compose.yml`. (`apps/backend/Dockerfile` bakes `ENV NODE_ENV=production`, which activates strict production secret checks in `config.schema.ts` that Compose never supplied — `docker compose up` could not previously reach a running backend. Fixed by having the `backend` service explicitly set `NODE_ENV=${NODE_ENV:-development}`, overriding the image default.)
- [x] Remove hard-coded reusable secrets from Compose; load development-only values through a git-ignored `.env` or an explicit safe bootstrap path. (Every dev credential in `docker-compose.yml` and `docker-compose.override.yml` — Postgres, MinIO, JWT, moderation token, pgadmin — now uses `${VAR:-default}` substitution; Compose auto-loads a git-ignored root `.env` if present. Verified via `tests/docker-compose.test.mjs`.)
- [ ] Decide which integrations are mandatory for local startup and which may be disabled behind explicit feature/config flags.
- [ ] Make disabled Stripe, Paystack, Shippo, email, SMS, and OAuth capabilities visible in health/readiness output.
- [ ] Never silently return payment success from mock providers unless an explicit development mock flag is enabled.
- [x] Add Compose health checks that prove backend readiness, not merely that the container process exists. (`backend`/`web`/`moderation` had no healthchecks at all. Added real ones — backend hits its existing `/api/v1/health/ready` endpoint (DB/Redis/MinIO/moderation-queue checks), web hits `/`, moderation hits its existing `/healthz`. `depends_on` upgraded to `condition: service_healthy` throughout.)

Dependencies: RR-001, RR-002.

Additional pre-existing, previously-undiscovered bugs found and fixed while getting a real `docker compose up --build` to succeed (none of this was RR-012 scope going in, but `docker compose up` could not reach a running state without them — see the RR-001 `.nvmrc` note above for the Node version correction):

- `apps/backend/Dockerfile` and `apps/web/Dockerfile` used `node:20-slim`, but pnpm `11.19.0` hard-requires Node ≥22.13 (`node:sqlite` built-in). Bumped both to `node:22-slim` (approved protected-path change).
- `packages/shared` had no `build` script (`main`/`types` pointed at raw `src/index.ts`), so `RUN pnpm --filter @forumo/shared build` in both Dockerfiles always failed. Worse: `apps/backend` imports real runtime values (Zod schemas) from `@forumo/shared` without declaring it as a dependency — it only "worked" via a `tsconfig.base.json` path alias that affects type-checking only, not the compiled runtime. `node dist/apps/backend/src/main.js` (exactly what the backend image runs) would have crashed on startup with `Cannot find module '@forumo/shared'`. Fixed by giving `@forumo/shared` a real `tsc` build to `dist/`, declaring it as a proper `workspace:*` dependency in `apps/backend/package.json`, and building it in the root `postinstall` step. Added a regression test (`tests/repository-hygiene.test.mjs`) that fails if backend ever imports an undeclared `@forumo/*` package again.

Acceptance criteria:

- [x] `docker compose up` reaches healthy state using documented development configuration. (Verified live: built all three custom images and ran the full stack — `backend`, `web`, `moderation`, `postgres`, `redis`, `minio`, `mailpit` all reported `healthy`; hit `/api/v1/health/ready` and got `{"status":"ok",...}` with database/redis/minio all `up`, and `web` returned HTTP 200. `pgadmin`, extra dev tooling from the override file and not part of this roadmap item, has a pre-existing, unrelated crash — see note below.)
- Production configuration still fails fast when required payment/webhook secrets are missing. (Unchanged — `config.schema.ts`'s production `superRefine` checks were not touched.)
- A developer can tell from logs and health output which external integrations are disabled. (Not addressed — remaining work.)
- [x] No real or reusable provider secret is committed. (For the credentials this pass touched — see above. Provider API keys are unaffected/still absent from Compose, as before.)

Tests:

- Config-schema tests for development, test, and production matrices. (Not added — remaining work.)
- Compose smoke test for Postgres, Redis, MinIO, moderation service, backend, web, and admin health. (`tests/docker-compose.test.mjs` covers the static config; the live smoke test was run manually this session, not automated into CI — remaining work. No `admin` service exists in `docker-compose.yml` today.)

Known pre-existing issue found, not fixed (out of this item's scope): `docker-compose.override.yml`'s `pgadmin` service crash-loops — pgadmin4 v8 rejects the default `PGADMIN_DEFAULT_EMAIL` value (`admin@local.test`) as an invalid address. Predates this session; the default value itself wasn't changed, only made overridable.

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

### Recommended execution order

1. RR-001 → RR-002 → RR-003: make results trustworthy.
2. RR-010 → RR-011 and RR-012: restore authentication and boot paths.
3. Architecture approval → RR-013: close the funds-held-indefinitely risk.
4. RR-020 → RR-021 → RR-023: make mobile authentication and connectivity real.
5. RR-022: verify every supported commerce provider path.
6. RR-030 → RR-031 → RR-032 → RR-033: enforce and document release gates.

### Open decisions

- [x] **Toolchain:** migrate deliberately to pnpm 11.19.0.
- [ ] **Local integrations:** must all providers be configured locally, or should explicit disabled/test adapters be supported?
- [ ] **Escrow scheduler:** BullMQ delayed jobs, database sweep, or a hybrid with reconciliation?
- [ ] **Automatic release policy:** is the five-day window fixed globally or configurable by market/order type?
- [ ] **Mobile demo mode:** remove completely or retain only in a separately identified development build?
- [ ] **Supported markets:** are GHS/KES seller payouts launch requirements before their transfer-recipient behavior is provider-verified?
- [ ] **Coverage scope:** which packages must meet 80% immediately, and what ratchet applies to legacy packages below target?

### Overall definition of done

- [ ] Clean-checkout install, type-check, lint, tests, E2E, and build pass using the enforced toolchain.
- [ ] Backend and Compose boot with documented configuration and truthful integration health.
- [ ] Auth refresh and Google OAuth pass browser E2E tests.
- [ ] Escrow automatic release is approved, idempotent, dispute-safe, observable, and recovery-tested.
- [ ] Supported payment/shipping flows have provider-sandbox evidence.
- [ ] Mobile critical paths pass against a real backend without demo authentication or localhost release defaults.
- [ ] CI enforces security scanning, 80%+ agreed coverage, and no regression in warnings.
- [ ] Release candidate smoke evidence and rollback instructions are complete.

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
