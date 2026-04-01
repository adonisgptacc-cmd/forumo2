# Forumo - Missing Features Analysis

## Current Build Error

**Type Error in `apps/web/src/lib/react-query/hooks.ts:73`**
```
Property 'create' does not exist on type '{ forListing: (_listingId: string) => Promise<any>; }'
```

**Root Cause:** TypeScript is not properly resolving the `ForumoApiClient` type from `@forumo/shared`. The `MockApiClient` has the `create` method, but TypeScript is inferring a union type incorrectly.

**Fix:** The issue is likely related to module resolution. Both `ApiError` and `ForumoApiClient` are exported from `packages/shared/src/api-client.ts` and re-exported via `index.ts`.

---

## Missing Backend Modules (vs. PRD Spec)

### ❌ **1. KYC Module** (Critical)
**Status:** NOT IMPLEMENTED  
**PRD Requirement:** Section 4.2 - KYC Verification Module  
**Required Features:**
- Document upload (ID, selfie, proof of address)
- OCR parsing
- AI fraud detection
- Manual review queue
- Admin approval/rejection workflow

**Database Tables Exist:** ✅ `KycSubmission` in Prisma schema  
**Backend Module:** ❌ Missing from `apps/backend/src/modules/`

---

### ❌ **2. Auctions Module** (Core Feature)
**Status:** NOT IMPLEMENTED  
**PRD Requirement:** Section 4.5 - Auctions Engine  
**Required Features:**
- Real-time bidding
- Proxy bidding
- Anti-sniping (time extensions)
- Reserve price
- Bid history
- Live countdown timers
- Buy Now option

**Database Tables Exist:** ✅ `Auction`, `Bid` in Prisma schema  
**Backend Module:** ❌ Missing from `apps/backend/src/modules/`

---

### ❌ **3. Inventory Module** (Essential)
**Status:** NOT IMPLEMENTED  
**PRD Requirement:** Section 4.12 - Inventory Engine  
**Required Features:**
- Multi-location inventory
- Stock reservations
- Stock alerts
- Damaged stock tracking
- Purchase order tracking
- Automatic stock deduction on orders

**Database Tables Exist:** ✅ `InventoryItem`, `InventoryReservation` in Prisma schema  
**Backend Module:** ❌ Missing from `apps/backend/src/modules/`

---

### ❌ **4. Escrow Module** (Critical for Payments)
**Status:** NOT IMPLEMENTED  
**PRD Requirement:** Section 4.6 - Orders & Escrow Module  
**Required Features:**
- Create escrow holding
- Automated release after X days
- Manual dispute override
- Refund workflows
- Detailed ledger entries
- Stripe/Escrow.com/Trustap integration

**Database Tables Exist:** ✅ `EscrowHolding`, `EscrowDispute`, `EscrowTransaction` in Prisma schema  
**Backend Module:** ❌ Missing from `apps/backend/src/modules/`

---

### ❌ **5. Notifications Module** (Required)
**Status:** NOT IMPLEMENTED  
**PRD Requirement:** Section 4.10 - Notifications Module  
**Required Features:**
- In-app notifications
- Email notifications
- SMS notifications
- Push notifications (mobile)
- Event triggers (new message, order updates, bid alerts, KYC results, etc.)

**Database Tables Exist:** ✅ `Notification` in Prisma schema  
**Backend Module:** ❌ Missing from `apps/backend/src/modules/`

---

### ❌ **6. AI Moderation Module** (Safety)
**Status:** PARTIALLY IMPLEMENTED  
**PRD Requirement:** Section 4.9 - AI Moderation System  
**Current Status:** Python service exists in `apps/moderation/` but not integrated  
**Required Features:**
- Detect scam keywords
- Abuse/harassment detection
- Inappropriate images
- Fraud signals
- Sentiment analysis
- Auto-warning to users
- Auto-escalation to moderators

**Integration:** ❌ Not connected to backend

---

## Missing Frontend Features (vs. Amazon-like Spec)

### Current `apps/web/src/app/page.tsx` Issues:

1. **❌ No Real Product Listings**
   - Currently shows static category cards
   - Should display actual listings from database
   - Missing product grid with images, prices, ratings

2. **❌ No Search Functionality**
   - Header has search bar but it's not functional
   - Should integrate with listings search API

3. **❌ No Auctions Section**
   - PRD specifies auctions as core feature
   - Should show "Ending Soon" auctions on homepage

4. **❌ No Deals Section**
   - Missing "Today's Deals" section
   - No featured/promoted listings

5. **❌ No Category Navigation**
   - Categories exist but clicking doesn't filter
   - Should integrate with `/listings?category=X`

6. **❌ Basic Styling**
   - Current design is minimal
   - PRD spec requires "Amazon look-alike"
   - Missing:
     - Product hover effects
     - Better image handling
     - Trust badges
     - Seller ratings display
     - "Add to Cart" buttons

---

## Database Schema Status

✅ **COMPLETE** - Your Prisma schema (`apps/backend/prisma/schema.prisma`) includes ALL required tables from the PRD:

- Users, KYC, Listings, Orders, Payments
- Escrow, Auctions, Inventory
- Messaging, Reviews, Notifications
- Admin, Moderation, Analytics

**The database design is comprehensive and matches the PRD perfectly.**

---

## What's Working

### ✅ Implemented Modules:
1. **Auth Module** - Login, register, JWT, 2FA
2. **Users Module** - User management
3. **Listings Module** - Create, update, search listings
4. **Orders Module** - Order creation and management
5. **Messaging Module** - Real-time chat
6. **Reviews Module** - Review creation and rollup
7. **Admin Module** - KYC review, listing moderation, disputes
8. **Storage Module** - File uploads (S3)
9. **Health Module** - Health checks
10. **Observability Module** - Metrics and logging

---

## Priority Fixes

### **Immediate (Build Blocking):**
1. Fix TypeScript type resolution for `ForumoApiClient`
2. Ensure `ApiError` and `ForumoApiClient` are properly exported

### **High Priority (Core Features):**
1. Implement **Escrow Module** - Critical for safe transactions
2. Implement **KYC Module** - Required for seller verification
3. Implement **Auctions Module** - Core marketplace feature
4. Implement **Inventory Module** - Prevent overselling

### **Medium Priority:**
1. Implement **Notifications Module** - User engagement
2. Integrate **AI Moderation** - Safety and trust
3. Enhance homepage with real listings
4. Add auction listings to homepage

### **Low Priority (Polish):**
1. Improve UI to match Amazon aesthetic
2. Add more interactive elements
3. Implement advanced search filters
4. Add seller dashboards

---

## Recommended Next Steps

1. **Fix the build error** - Resolve TypeScript module resolution
2. **Create missing backend modules** in this order:
   - Escrow (most critical)
   - KYC (verification)
   - Inventory (stock management)
   - Auctions (core feature)
   - Notifications (user experience)
3. **Enhance the homepage** - Display real listings, auctions, deals
4. **Integrate AI moderation** - Connect Python service to backend
5. **Add missing API routes** - Ensure all PRD endpoints exist

---

## Architecture Completeness

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ 100% | All tables from PRD exist |
| Backend Modules | 🟡 60% | Core modules done, missing 6 critical ones |
| Frontend Pages | 🟡 40% | Basic pages exist, need enhancement |
| API Client | ✅ 90% | Well-structured, minor export issue |
| Mobile App | 🟡 50% | Structure exists, needs features |
| AI Moderation | 🟡 30% | Service exists, not integrated |
| Admin Console | ✅ 80% | Basic admin features working |

**Overall Completion: ~65%**

The foundation is solid, but critical payment/safety features (Escrow, KYC, Inventory) are missing.
