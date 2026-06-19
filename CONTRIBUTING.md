# Contributing to Forumo

Thanks for your interest. Forumo is in active early development — contributions are welcome but the codebase is moving fast. Read this before opening a PR.

## What's needed most right now

The highest-value areas to contribute to, in priority order:

### Backend
- **Rate limiting on notifications** — `NotificationsController` has no rate limiting unlike auth endpoints
- **Authenticated-only review submission** — review endpoints should verify the reviewer was a party to the relevant order
- **Seller payout flow validation** — `PayoutsModule` exists; validate the ZAR/Stripe Connect payout path end-to-end

### Frontend
- **Escrow dispute UI** — `/app/orders/[id]` should allow a buyer to open a dispute
- **Admin stats dashboard** — `/admin` landing page wired to `GET /admin/dashboard/stats`
- **Error boundaries** — add `error.tsx` to all route groups
- **Cart variant integration** — variant selection should update the cart payload correctly

### Mobile (`apps/mobile` — pre-alpha)
- Shopping cart + checkout screens
- Orders history + detail screens
- Auction detail with live bidding (Socket.IO)
- Offers screen
- Search + advanced filters
- Notifications screen

### Tests (currently ~15% coverage)
- Escrow service spec (dispute, release, refund)
- Frontend E2E: cart → checkout flow (Playwright)
- Frontend E2E: auth flow

## Development setup

Follow the [Getting started](README.md#getting-started) section in the README exactly.

## Branch naming

```
feat/<scope>/<short-description>   # new feature
fix/<scope>/<short-description>    # bug fix
chore/<scope>/<short-description>  # tooling, deps, housekeeping
docs/<short-description>           # documentation only
```

Examples: `feat/listings/add-video-upload`, `fix/orders/escrow-release-race`, `chore/deps/bump-prisma-5.21`

## Running tests locally

```bash
# All tests
pnpm test

# Backend only (faster, no frontend compile)
pnpm --filter backend test

# Backend with coverage
pnpm --filter backend test:coverage

# E2E (requires docker-compose.test.yml stack running)
pnpm test:e2e
```

The backend test suite uses an in-memory SQLite database via Prisma — no running PostgreSQL needed for unit tests.

## Running the linter

```bash
# Lint all packages
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Check formatting (Prettier)
pnpm format:check

# Apply formatting
pnpm format

# TypeScript type-check across all packages
pnpm typecheck
```

Before opening a PR, run `pnpm typecheck && pnpm lint && pnpm test` and make sure all pass.

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org):

```
feat(search): apply category and sort filters to listing query
fix(cart): pass variant id in add-to-cart payload
feat(kyc): add KYC document submission form
chore(deps): bump prisma to 5.14
```

Scopes: `auth`, `listings`, `orders`, `offers`, `search`, `cart`, `kyc`, `escrow`, `messaging`, `auctions`, `admin`, `mobile`, `shared`, `infra`

## Pull requests

- Branch off `develop`; target `develop` (not `main`) unless it's a hotfix
- Keep PRs focused — one feature or fix per PR
- Include a short description of what changed and why
- If you're fixing a bug, describe how to reproduce it
- All PRs must pass the CI pipeline: lint, typecheck, unit tests, and build
- After merging to `develop`, a maintainer will promote to `main` for deployment

## Pre-existing known issues

These are documented bugs that are not regressions — don't raise them as new issues:

- `inventory.service.ts` — Prisma JSON type errors
- `listings.spec.ts` — type mismatches in test mocks
- `audit-log.service.ts` — Prisma JSON type error
