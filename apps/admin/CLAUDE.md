# Admin

Separate Next.js 15 dashboard for Forumo internal staff. Runs on port 3001. Requires `ADMIN` or `MODERATOR` role — the main buyer/seller web app (`apps/web`) cannot access these pages. Currently under active development; most pages are stubs.

## Tech stack

| | Version |
|---|---|
| Next.js | 15.0.0-canary.36 (App Router) |
| React | 18.3.x |
| NextAuth | 4.24.x |
| TanStack Query | 5.51.x |
| TailwindCSS | 4.1.x |
| @forumo/shared | workspace |
| @forumo/design-system | workspace |

## Run locally

```bash
# From apps/admin
pnpm dev         # starts on port 3001

# Or from repo root
pnpm dev:admin
```

Requires the backend to be running on port 4000.

## Key environment variables

```
NEXT_PUBLIC_API_BASE_URL       # Backend URL, e.g. http://localhost:4000
NEXTAUTH_SECRET                # Must match or be separate from the web app secret
NEXTAUTH_URL                   # Full URL of this app, e.g. http://localhost:3001
```

## Auth requirements

Only users with role `ADMIN` or `MODERATOR` should be able to access this app. The layout must check `session.user.role` and redirect unauthorised users. This role check is enforced by both the frontend layout and backend API guards — a non-admin token will get 403 from the backend regardless of what the frontend allows.

## Planned pages

| Page | Purpose |
|---|---|
| `/admin` | Overview dashboard — pending actions, counts |
| `/admin/moderation` | Listing moderation queue — approve/reject pending listings |
| `/admin/kyc` | KYC submission review — approve/reject user KYC documents |
| `/admin/disputes` | Dispute management — review and resolve order disputes |
| `/admin/users` | User management — view, suspend, ban accounts |
| `/admin/categories` | Category and tag CRUD |
| `/admin/fees` | Fee schedule management |
| `/admin/analytics` | Platform-wide analytics |

## How it connects to the backend

Uses `ForumoApiClient` from `@forumo/shared`, same as the web app. Admin-specific endpoints are under `api.admin.*`:

```ts
api.admin.disputes.list()
api.admin.disputes.get(id)
api.admin.disputes.updateStatus(id, { status })
api.admin.kyc.list()
api.admin.kyc.get(id)
api.admin.kyc.updateStatus(id, { status })
api.admin.moderation.list()
api.admin.moderation.approve(listingId)
api.admin.moderation.reject(listingId, { reason })
```

All admin endpoints on the backend require `@Roles(UserRole.ADMIN)` or `@Roles(UserRole.MODERATOR)` guards.

## Current state

- Project scaffold is in place (package.json, tsconfig, Next.js config).
- `src/app/` and `src/components/` directories exist but page implementations are minimal stubs.
- No auth flow built — you must wire up NextAuth (same pattern as `apps/web/src/lib/auth.ts`) before any protected routes will work.
- No test suite configured yet.

## Sharp edges

- This app runs on port 3001. If you start `apps/web` and `apps/admin` together, make sure `NEXTAUTH_URL` is set correctly for each (3000 vs 3001) — NextAuth uses this for callback URLs.
- Both apps share `@forumo/shared` but have independent NextAuth instances with separate `NEXTAUTH_SECRET` values (or the same — either works, but they should not share session cookies across ports unless explicitly configured).
- Do not reuse the `apps/web` CLAUDE.md patterns for this app until the auth and layout are properly built — the pages here are too early-stage to establish conventions.
