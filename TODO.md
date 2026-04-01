# Forumo – Outstanding Work

Last updated: April 2026.

---

## Completed ✅

- **User Profile page** (`/app/profile`) — account settings, avatar upload, trust score
- **Offers UI** — "Make an offer" modal on listing detail, `/app/offers` board, accept/decline
- **Seller Dashboard** (`/app/dashboard`) — revenue, orders, pending offers, top listings
- **Wishlist / Favorites** — `SavedListing` model, backend CRUD, heart button, `/app/wishlist` page
- **Storefront: update + delete** — `PATCH/DELETE /storefronts/me`
- **Storefront: Collections CRUD** — full endpoints + frontend management
- **ListingCategory API** — `GET /categories`, admin endpoints, `/admin/categories` UI
- **ListingTag API** — `GET /categories/tags`, admin endpoints
- **Order Detail** (`/app/orders/[id]`) — full timeline, items, escrow, action buttons
- **React Query hooks** — useProfile, useOrder, useOffers, useWishlist, useCategories, useTags, useStorefront, useCollections and all mutations

---

## Priority 1 — Backend

- [ ] **Fix search sort/categories** — `listings.service.ts` search() ignores `sort` and `categories` params; wire `orderBy` and category `where` into Prisma query
- [ ] **MinIO/S3 storage swap** — `StorageService` uses local filesystem; implement MinIO adapter using `STORAGE_ENDPOINT`, `STORAGE_BUCKET` env vars so uploads work in production
- [ ] **Seller analytics endpoint** — `GET /orders/seller/analytics` (revenue by period, order count, avg order value) for seller dashboard charts
- [ ] **Rate limiting on notifications endpoints** — `NotificationsController` has no rate limiting unlike auth endpoints

---

## Priority 2 — Frontend Polish

- [ ] **Listing detail: variant → cart** — selecting a variant should update Add to Cart payload (variantId, variantLabel, priceCents)
- [ ] **Shop page listings grid** — `/shops/[slug]` shows storefront info but doesn't list seller's listings
- [ ] **KYC submission UI** — backend fully done, no frontend form for buyers/sellers to upload documents
- [ ] **Escrow dispute UI** — `/app/orders/[id]` should allow buyer to open a dispute
- [ ] **Admin stats dashboard** — `/admin` landing page; wire to `GET /admin/dashboard/stats`
- [ ] **Loading/error boundaries** — missing from several page routes
- [ ] **Auction page filters** — `/auctions` needs pagination and category/status filters

---

## Priority 3 — Mobile App (~25% complete)

- [ ] Shopping cart screen
- [ ] Checkout screen
- [ ] Orders history + detail screens
- [ ] Auction detail + live bidding (Socket.IO)
- [ ] User profile + settings screen
- [ ] Offers screen
- [ ] Reviews screen
- [ ] Search + advanced filters
- [ ] Notifications screen

---

## Priority 4 — Tests (~15% coverage)

- [ ] Auctions service spec (bid logic, auto-end processor)
- [ ] Escrow service spec (dispute, release, refund)
- [ ] Notifications service spec
- [ ] Offers service spec
- [ ] KYC service spec
- [ ] Inventory service spec
- [ ] Frontend E2E: cart → checkout flow (Playwright)
- [ ] Frontend E2E: auth flow

---

## Priority 5 — Infrastructure

- [ ] MinIO service in `docker-compose.yml` for local dev
- [ ] Document missing env vars (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `FRONTEND_URL`, `NEXT_PUBLIC_API_BASE_URL`) in root `.env.example`
- [ ] Verify Google OAuth callback URL wiring with live credentials
- [ ] Confirm CI pipeline runs type checks, tests, and build for all apps
- [ ] Observability — wire OpenTelemetry metrics properly or remove the stub endpoint

---

## Tracking

| Area | Items | Completed |
|------|-------|-----------|
| Backend | 4 | 0 |
| Frontend | 7 | 0 |
| Mobile | 9 | 0 |
| Tests | 8 | 0 |
| Infrastructure | 5 | 0 |
| **Total** | **33** | **0** |
