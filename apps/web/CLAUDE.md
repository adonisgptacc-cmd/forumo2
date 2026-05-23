# Web

Next.js 15 (App Router) frontend for Forumo buyers and sellers. Handles listing browsing, checkout, order management, messaging, auctions, seller dashboards, storefronts, and account settings. Runs on port 3000.

## Tech stack

| | Version |
|---|---|
| Next.js | 15.0.0-canary.36 |
| React | 18.3.x |
| NextAuth | 4.24.x |
| TanStack Query | 5.51.x |
| TailwindCSS | 4.1.x |
| Stripe.js | @stripe/react-stripe-js 5.x |
| Framer Motion | 12.x |
| Socket.IO client | 4.8.x |
| React Hook Form | 7.x |
| Recharts | 3.x |

## Run locally

```bash
# From apps/web
pnpm dev

# Or from repo root
pnpm dev:web
```

Requires the backend to be running on port 4000 (`pnpm dev:backend`).

## Key environment variables

```
NEXT_PUBLIC_API_BASE_URL       # Backend URL, e.g. http://localhost:4000
NEXTAUTH_SECRET                # Random secret for NextAuth JWT signing
NEXTAUTH_URL                   # Full URL of this app, e.g. http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_USE_API_MOCKS      # Set to "true" in dev to enable mock auth fallback
NEXT_PUBLIC_SENTRY_DSN         # Optional — omit to disable Sentry
NEXT_PUBLIC_TOS_VERSION        # Must match backend TOS_VERSION env var
```

## App Router layout

```
src/app/
├── layout.tsx                  # Root layout — AppProviders, header, footer, TosModal, CookieConsent
├── page.tsx                    # Public homepage — hero, category grid, featured listings
├── globals.css                 # Global styles + Tailwind imports
│
├── (authenticated)/app/        # Route group: all routes require auth session
│   ├── layout.tsx              # Checks session; redirects to /login if absent
│   ├── overview/               # Buyer overview / activity feed
│   ├── dashboard/              # Seller dashboard — revenue, orders, pending offers
│   ├── storefront/             # Seller storefront management
│   ├── orders/                 # Order list + [id] detail
│   ├── offers/                 # Offer board + make-offer modal
│   ├── wishlist/               # Saved listings
│   ├── messages/               # Messaging UI
│   ├── cart/                   # Shopping cart
│   ├── profile/                # User profile view/edit, avatar, trust score
│   └── settings/account/       # Account settings — TOS, data export, account deletion
│
├── (admin)/admin/              # Route group: ADMIN role required
│   ├── layout.tsx              # Role check
│   ├── moderation/             # Listing moderation queue
│   ├── kyc/                    # KYC submission review
│   ├── disputes/               # Dispute management
│   └── categories/             # Category + tag management
│
├── auth/                       # Public auth pages
│   ├── login/                  # Login form
│   ├── signup/                 # Registration form
│   └── [...nextauth]/          # NextAuth API route handler
│
├── listings/                   # Public listing pages
│   ├── page.tsx                # Search/browse with filters
│   ├── [id]/                   # Listing detail with offer modal, wishlist toggle
│   └── new/                    # Create new listing form (auth required)
│
├── orders/[id]/                # Order detail with timeline, escrow, action buttons
├── messages/                   # Top-level messaging (redirects into /app/messages)
├── auctions/                   # Auction list + [id] detail + bidding
└── shops/[slug]/               # Public seller storefront
```

## Auth setup

`src/lib/auth.ts` — NextAuth v4, JWT session strategy.

Two Credentials providers:
1. **token-auth** — accepts a pre-issued JWT token, calls `/auth/me` to validate it.
2. **credentials** — email/password login via `api.auth.login()`. In dev with `NEXT_PUBLIC_USE_API_MOCKS=true`, falls back to a mock SELLER user when the API call fails.

The `session.accessToken` field holds the backend JWT. Pass it when constructing `ForumoApiClient`.

There is **no silent token refresh**. The JWT expires after 7 days. Users are silently logged out when it expires.

## ForumoApiClient usage

```ts
import { useApiClient } from '@/lib/use-api-client';

// In a component
const api = useApiClient(); // returns ForumoApiClient with session token attached

// Or directly
import { createApiClient } from '@/lib/api-client';
const api = createApiClient(token);
await api.listings.search({ q: 'shoes', page: 1 });
```

`src/lib/api-client.ts` wraps `ForumoApiClient` from `@forumo/shared` and attaches the NextAuth session token. When `NEXT_PUBLIC_USE_API_MOCKS=true`, it returns a mock client backed by `sessionStorage`.

## React Query patterns

All hooks live in `src/lib/react-query/hooks.ts`. Query keys are in `src/lib/react-query/query-keys.ts`.

Pattern for a new data-fetching hook:
```ts
// query-keys.ts
export const keys = {
  myThing: (id: string) => ['my-thing', id] as const,
};

// hooks.ts
export function useMyThing(id: string) {
  const api = useApiClient();
  return useQuery({
    queryKey: keys.myThing(id),
    queryFn: () => api.myThing.get(id),
  });
}
```

Pattern for a mutation hook:
```ts
export function useUpdateMyThing() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMyThingDto) => api.myThing.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.myThing(...) }),
  });
}
```

## TailwindCSS 4

Config is via `postcss.config.mjs` using `@tailwindcss/postcss`. There is no `tailwind.config.js` — Tailwind 4 reads config from `globals.css` directly.

Custom design tokens (defined in `globals.css`):
- `forumo-orange` — primary brand orange
- `forumo-gold` — accent gold
- `forumo-link` — link colour
- `card-forumo` — card surface utility class
- `btn-forumo` — primary button utility class

Always use `clsx` + `tailwind-merge` for conditional className composition:
```ts
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

## Known gaps

- **Email verification UI** — the backend has OTP endpoints for email verification but there is no frontend flow for it. Users can register without verifying email.
- **KYC submission UI** — the backend KYC pipeline is complete but there is no frontend page for submitting KYC documents.
- **Escrow dispute UI** — disputes can be opened via API but there is no buyer-facing dispute form.
- **Cart variant integration** — cart exists but product variants (size, colour) are not wired into the add-to-cart flow.
- **No error boundaries** — route segments do not have `error.tsx` files. Unhandled errors bubble to the root layout.
- **Admin panel** — an `(admin)` route group exists in this app but the full admin experience is a separate app (`apps/admin`). The admin pages here are partially built.
- **Silent token refresh** — no refresh token flow. 7-day JWT; users must log in again after expiry.

## TypeScript status

`tsc --noEmit` is clean (zero errors). Non-obvious things keeping it that way:
- All listing search hooks return `response.data` (paginated), not `response.listings` — the API wraps results in `{ data, total, page, pageSize, pageCount }`.
- `useEscrowDetails` is typed as `Record<string, unknown>`, not `unknown`, so it can be spread in JSX without errors.
- `auth.ts` JWT callback is annotated `: Promise<any>` to allow `null` return on token expiry.
- Dynamic Next.js route `href` values must be cast `as any` — e.g. `href={"/app/orders/" + id as any}`.
- `(order as any).shippingAddress` in order-detail — shippingAddress is not on the SafeOrder schema.
- `(order.escrow as any).disputes` in admin orders page — disputes sub-array is not typed on the escrow schema.
- `analytics-view.tsx` uses `point.date`, `point.revenue`, `point.orders`, `listing.revenue`, `overview.gmv`, `overview.avgOrderValue`, `summary.avgRating`, `summary.totalReviews` — match the exact field names from `SellerRevenuePoint`, `SellerTopListing`, `SellerAnalyticsOverview`, `SellerReviewsSummary` in `@forumo/shared`.

## Conventions

- Route type casting: when using `href` with dynamic Next.js routes, cast to `any`: `href={"/app/orders/" + id as any}`.
- All data fetching goes through `ForumoApiClient` — never call `fetch()` directly to the backend.
- Pages under `(authenticated)/` assume a session exists; the layout handles the redirect.
- `src/lib/messaging-layer.ts` manages the Socket.IO connection. Use the `useMessaging` hook; do not instantiate `io()` directly in components.
- Do not add `"use client"` to layout files unless absolutely necessary. Keep server components at layout level.
