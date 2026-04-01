# Forumo – Outstanding Work

Generated from codebase audit, March 2026. Ordered by impact on MVP.

---

## Priority 1 — Core Commerce (Blockers)

- [ ] **Fix backend search sort/categories** — `listings.service.ts` search() ignores `sort` and `categories` params, Prisma query needs `orderBy` and category `where` wired in
- [ ] **User Profile page** (`/app/profile`) — account settings form (name, phone, avatar upload), address management, change password
- [ ] **Offers UI on listing detail** — "Make an offer" button, offer form, offer status badge; also `/app/offers` page listing sent/received offers with accept/decline actions
- [ ] **Seller Dashboard** (`/app/dashboard`) — orders summary, revenue totals, top-performing listings, recent activity feed
- [ ] **Wishlist / Favorites** — add `Wishlist` model to Prisma schema, backend CRUD endpoints, heart button on listing cards, `/app/wishlist` page

---

## Priority 2 — Backend Completions

- [ ] **Storefront: update + delete endpoints** — `PATCH /storefronts/:slug` and `DELETE /storefronts/:slug` missing from `storefronts.service.ts` (45 lines, very incomplete)
- [ ] **Storefront: Collections CRUD** — `Collection` model exists in schema with zero endpoints; need `POST /storefronts/:slug/collections`, `GET`, `PATCH`, `DELETE`
- [ ] **Storefront Management UI** — frontend page for sellers to edit their shop name/bio/logo and manage collections
- [ ] **ListingCategory API** — `ListingCategory` model exists; need admin endpoints `GET/POST/PATCH/DELETE /admin/categories` and `GET /categories` (public)
- [ ] **ListingTag API** — `ListingTag` model exists; need tag management endpoints and auto-suggest on listing create/edit form
- [ ] **Seller analytics endpoints** — `GET /orders/seller/analytics` (revenue by period, order count, average order value) consumed by seller dashboard
- [ ] **Admin: Category + Tag management pages** — admin UI at `/admin/categories` and `/admin/tags` using new endpoints above
- [ ] **MinIO/S3 storage swap** — `StorageService` uses local filesystem; implement MinIO adapter using existing env vars (`STORAGE_ENDPOINT`, `STORAGE_BUCKET`, etc.) so uploads work in production

---

## Priority 3 — Mobile App (≈25% complete)

- [ ] **Mobile: Shopping cart screen** — `CartScreen.tsx`, add-to-cart from listing detail, quantity controls, seller-grouped layout
- [ ] **Mobile: Checkout screen** — `CheckoutScreen.tsx`, order review per seller, place order via API
- [ ] **Mobile: Orders history screen** — `OrdersScreen.tsx`, list user's orders with status badges, tap for detail
- [ ] **Mobile: Order detail screen** — `OrderDetailScreen.tsx`, timeline, items, shipment tracking, escrow status
- [ ] **Mobile: Auction detail + bidding** — `AuctionDetailScreen.tsx`, live bid feed via Socket.IO, place bid form, countdown timer
- [ ] **Mobile: User profile + settings screen** — `ProfileScreen.tsx`, edit name/phone/avatar, sign out
- [ ] **Mobile: Offers screen** — `OffersScreen.tsx`, sent/received offers, accept/decline
- [ ] **Mobile: Reviews screen** — `ReviewsScreen.tsx`, view and submit reviews
- [ ] **Mobile: Search + advanced filters** — search bar with sort and category filters on `ListingDiscoveryScreen`
- [ ] **Mobile: Notifications screen** — `NotificationsScreen.tsx`, list + mark as read, connect to Socket.IO gateway

---

## Priority 4 — Frontend Polish

- [ ] **`/orders` public route access** — currently unprotected; restrict to authenticated users or redirect to `/app/orders`
- [ ] **Duplicate `/messages` routes** — both `/messages` (public) and `/app/messages` (authenticated) exist; consolidate or add auth guard to public route
- [ ] **Listing detail: variant selection wired to cart** — selecting a variant should update the Add to Cart payload (variantId, variantLabel, priceCents)
- [ ] **Auction listing page** — `GET /auctions` endpoint exists but `/auctions/page.tsx` likely needs pagination and filters
- [ ] **Shop page completeness** — `/shops/[slug]` shows storefront but doesn't list the seller's listings; add listings grid
- [ ] **KYC submission UI** — buyers/sellers can't submit KYC documents from the frontend (backend fully implemented, no frontend form)
- [ ] **Escrow dispute UI** — `/app/orders/[id]` should show escrow status and allow buyer to open a dispute
- [ ] **Order detail page** — `/app/orders/[id]` does not exist; orders board shows all orders but no detail view
- [ ] **404 page** — no `not-found.tsx` at app root
- [ ] **Loading/error boundaries** — missing from several page routes
- [ ] **`/admin` stats dashboard** — admin landing page (`/admin/page.tsx`) exists but likely shows placeholder stats; wire to `GET /admin/dashboard/stats`

---

## Priority 5 — Test Coverage (~15%)

- [ ] **Auctions tests** — no spec file for `auctions.service.ts` (237 lines, bid logic, auto-end processor)
- [ ] **Escrow tests** — no spec file for `escrow.service.ts` (dispute workflow, release/refund)
- [ ] **Notifications tests** — no spec for new `notifications.service.ts` CRUD methods
- [ ] **Offers tests** — no spec for `offers.service.ts` (accept/decline logic)
- [ ] **KYC tests** — no spec for `kyc.service.ts`
- [ ] **Inventory tests** — no spec for `inventory.service.ts` (reservation + adjustment logic)
- [ ] **Reviews moderation tests** — `moderation.service.spec.ts` exists but may be incomplete
- [ ] **Frontend E2E: cart → checkout flow** — add Playwright test covering add to cart, checkout, order confirmation
- [ ] **Frontend E2E: auth flow** — login, signup, OAuth callback

---

## Priority 6 — Infrastructure & DevOps

- [ ] **MinIO local dev setup** — add MinIO service to `docker-compose.yml` so local dev matches production storage
- [ ] **Missing env vars documented** — `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `FRONTEND_URL`, `NEXT_PUBLIC_API_BASE_URL` not in root `.env.example`
- [ ] **Google OAuth env vars** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` present in backend `.env.example` but callback URL wiring needs verification with live credentials
- [ ] **CI pipeline coverage** — `.github/workflows/ci.yml` exists; verify it runs backend + frontend type checks, tests, and build
- [ ] **Rate limiting on notifications endpoints** — `NotificationsController` has no rate limiting unlike auth endpoints
- [ ] **Observability / MetricsService** — currently a 10-line stub; wire up OpenTelemetry metrics properly or remove the endpoint

---

## Tracking

| Area | Est. Items | Completed |
|------|-----------|-----------|
| Core commerce | 5 | 0 |
| Backend completions | 8 | 0 |
| Mobile screens | 10 | 0 |
| Frontend polish | 11 | 0 |
| Tests | 9 | 0 |
| Infrastructure | 6 | 0 |
| **Total** | **49** | **0** |
