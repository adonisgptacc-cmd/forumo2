# Contributing to Forumo

Thanks for your interest. Forumo is in active early development — contributions are welcome but the codebase is moving fast. Read this before opening a PR.

## What's needed most right now

The highest-value areas to contribute to, in priority order:

### Backend
- **Fix search filtering** — `listings.service.ts` `search()` ignores `sort` and `categories` params; wire `orderBy` and category `where` into the Prisma query
- **MinIO/S3 storage adapter** — `StorageService` currently uses local filesystem; implement a MinIO adapter using `STORAGE_ENDPOINT` and `STORAGE_BUCKET` env vars
- **Seller analytics endpoint** — `GET /orders/seller/analytics` (revenue by period, order count, avg order value)
- **Rate limiting on notifications** — `NotificationsController` has no rate limiting unlike auth endpoints

### Frontend
- **KYC submission form** — backend is fully built, the UI form for document upload is missing
- **Escrow dispute UI** — `/app/orders/[id]` should allow a buyer to open a dispute
- **Admin stats dashboard** — `/admin` landing page wired to `GET /admin/dashboard/stats`
- **Error boundaries** — add `error.tsx` to all route groups
- **Auction page filters** — pagination and category/status filters on `/auctions`

### Mobile (`apps/mobile` — pre-alpha)
- Shopping cart + checkout screens
- Orders history + detail screens
- Auction detail with live bidding (Socket.IO)
- Offers screen
- Search + advanced filters
- Notifications screen

### Tests (currently ~15% coverage)
- Auctions service spec (bid logic, auto-end processor)
- Escrow service spec (dispute, release, refund)
- Frontend E2E: cart → checkout flow (Playwright)
- Frontend E2E: auth flow

## Development setup

Follow the [Getting started](README.md#getting-started) section in the README exactly.

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

- Keep PRs focused — one feature or fix per PR
- Include a short description of what changed and why
- If you're fixing a bug, describe how to reproduce it
- All PRs run the CI pipeline (`pnpm typecheck && pnpm lint && pnpm test`)

## Pre-existing known issues

These are documented bugs that are not regressions — don't raise them as new issues:

- `inventory.service.ts` — Prisma JSON type errors
- `listings.spec.ts` — type mismatches in test mocks
- `audit-log.service.ts` — Prisma JSON type error
