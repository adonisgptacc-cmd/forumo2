# Admin

Separate Next.js 15 dashboard for Forumo internal staff. Runs on port 3001. Requires `ADMIN` role (the backend `AdminController` is `@Roles('ADMIN')`) — the main buyer/seller web app (`apps/web`) cannot access these pages. NextAuth and a role-gated middleware are wired; six pages are implemented and the app typechecks clean.

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

Uses `ForumoApiClient` from `@forumo/shared` via `createApiClient(token)` in `src/lib/api-client.ts`. The admin namespace is **flat** (not nested) — these are the actual methods:

```ts
api.admin.listKycSubmissions()
api.admin.reviewKycSubmission(id, { status, rejectionReason })
api.admin.listListingsForReview()
api.admin.reviewListing(id, { moderationStatus, moderationNotes })
api.admin.listDisputes()
api.admin.resolveDispute(id, { status, resolution })
api.admin.listUsers({ search, status, role, page, limit })   // server-side filtered + paginated
api.admin.suspendUser(id, reason, durationDays?)
api.admin.unsuspendUser(id)
api.admin.banUser(id, reason)
```

All admin endpoints on the backend require `@Roles('ADMIN')` (`AdminController` in `apps/backend/src/modules/admin/`).

## Current state

- NextAuth is wired (`src/lib/auth.ts`) with a role-gated `src/middleware.ts` that redirects non-admins to `/403`.
- Six pages are implemented and functional (TanStack Query + the shared client): `/admin/users`, `/admin/kyc`, `/admin/listings`, `/admin/moderation`, `/admin/disputes`, `/admin/analytics`. Shared UI in `src/components/` (DataTable, Badge, PageHeader, ErrorState, Sidebar). There is no dedicated `/admin` overview page — it redirects to `/admin/users`.
- `tsc --noEmit` is clean.
- Not yet built: `/admin/categories`, `/admin/fees` (see "Planned pages"). No test suite configured yet.

## Sharp edges

- This app runs on port 3001. If you start `apps/web` and `apps/admin` together, make sure `NEXTAUTH_URL` is set correctly for each (3000 vs 3001) — NextAuth uses this for callback URLs.
- Both apps share `@forumo/shared` but have independent NextAuth instances with separate `NEXTAUTH_SECRET` values (or the same — either works, but they should not share session cookies across ports unless explicitly configured).
- Do not reuse the `apps/web` CLAUDE.md patterns for this app until the auth and layout are properly built — the pages here are too early-stage to establish conventions.
