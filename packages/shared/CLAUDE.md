# packages/shared

Shared library used by `apps/web`, `apps/admin`, and `apps/mobile`. Exports two things: **Zod schemas + TypeScript types** for all domain models, and **`ForumoApiClient`** — a typed HTTP client for the Forumo backend.

## Tech stack

- TypeScript 5.4.x
- Zod 3.23.8

No runtime framework dependency. No browser-specific code — safe to use in Node.js, React Native, and Next.js server components.

## Install / import

Already a workspace dependency. Import directly:

```ts
import { ForumoApiClient, SafeUser, safeUserSchema } from "@forumo/shared";
```

## ForumoApiClient

```ts
import { ForumoApiClient } from "@forumo/shared";

const api = new ForumoApiClient({
  baseUrl: "http://localhost:4000",
  getToken: () => yourAuthToken, // called on every request; return undefined for unauthenticated calls
});
```

The client exposes typed namespaces. Every namespace method calls `fetch`, parses the response with the corresponding Zod schema, and throws on parse failure or non-2xx status.

### Available namespaces

```
api.auth          login, register, me, logout, forgotPassword, resetPassword, changePassword
api.listings      search, get, create, update, delete, uploadImage, report
api.orders        list, get, create, updateStatus, confirm, pay
api.messages      listThreads, createThread, listMessages, sendMessage, markRead
api.reviews       list, create, updateStatus
api.auctions      list, get, create, placeBid, listBids
api.offers        list, get, create, accept, decline
api.cart          get, addItem, updateItem, removeItem, clear, merge
api.wishlist      list, save, remove
api.storefronts   get, getBySlug, create, update, delete, listCollections, createCollection
api.shipping      getRates, createLabel, trackShipment
api.returns       list, get, initiate, approve, reject
api.payouts       list, initiate
api.notifications list, markRead, markAllRead
api.analytics     sellerSummary, sellerRevenue
api.admin         disputes (list/get/updateStatus), kyc (list/get/updateStatus), moderation (list/approve/reject)
api.legal         acceptTos, deleteAccount, cancelDeletion, exportData
api.fees          list, preview
api.categories    list, create, update, delete, listTags, createTag
```

`api.cart` is implemented directly in `ForumoApiClient` (not via a Zod-parsed namespace) because the cart response shape is flexible. It uses the raw `request()` helper and returns `unknown` / `void`.

### Generic HTTP methods

If you need to call an endpoint not yet wrapped in a namespace:

```ts
api.get<ReturnType>("/some/path", schema);
api.post<ReturnType>("/some/path", body, schema);
api.patch<ReturnType>("/some/path", body, schema);
api.delete<ReturnType>("/some/path", schema);
```

## Zod schema conventions

All schemas are in `src/types.ts`. Naming pattern:

| Purpose                  | Naming                                              |
| ------------------------ | --------------------------------------------------- |
| Response type            | `Safe{Model}` (e.g. `SafeUser`, `SafeListing`)      |
| Schema for response type | `safe{Model}Schema` (e.g. `safeUserSchema`)         |
| Create DTO               | `Create{Model}Dto` + `create{Model}Schema`          |
| Update DTO               | `Update{Model}Dto` + `update{Model}Schema`          |
| List/search params       | `{Model}SearchParams` + `{model}SearchParamsSchema` |
| Admin types              | `Admin{Purpose}` (e.g. `AdminKycSubmission`)        |

Every exported type has a corresponding exported Zod schema. Always export both.

## How to add a new shared type

1. Define the Zod schema in `src/types.ts`:
   ```ts
   export const myThingSchema = z.object({
     id: z.string(),
     name: z.string(),
   });
   export type MyThing = z.infer<typeof myThingSchema>;
   ```
2. Export it from `src/index.ts` (or it re-exports from `src/types.ts` automatically — check the index).
3. Add a method to the relevant namespace in `src/api-client.ts`:
   ```ts
   myThings = {
     get: async (id: string): Promise<MyThing> =>
       this.get(`/my-things/${id}`, myThingSchema),
   };
   ```
4. Run `pnpm build` or `pnpm typecheck` from the workspace root to verify nothing broke.

## Key files

```
src/
├── types.ts        # All Zod schemas and inferred TypeScript types
├── api-client.ts   # ForumoApiClient class — all HTTP methods and namespaces
└── index.ts        # Public exports
```

## Key schema notes

- `ListingStatus` is `'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'SUSPENDED'`. The backend's `listing.serializer.ts` mirrors this exact union — keep them in sync.
- `createListingSchema` has `sellerId` as optional; the backend infers it from the JWT.
- `listingImageSchema` has `url` with `.default('')` — never `undefined`, always at least an empty string.
- `ReviewRollup` includes optional `star1`–`star5` count fields alongside `avgRating` and `totalReviews`.
- `SafeUser` includes `tosVersion`, `termsAcceptedAt`, and `deletionScheduledAt`. If you add fields to the backend `User` model that should be surfaced to clients, add them to `safeUserSchema` here as well.
- `listingSearchResponseSchema` wraps results in `{ data, total, page, pageSize, pageCount }`. Frontend hooks must access `response.data` not `response.listings`.

## Sharp edges

- `ForumoApiClient` validates every API response against Zod. If the backend changes a response shape without updating the schema here, the client will throw a `ZodError` at runtime. Update both sides together.
- The `getToken` constructor option is called on every request — it is not cached inside the client. If your token can change (e.g. NextAuth session refresh), this is intentional.
- There is no built-in retry logic. Callers (e.g. React Query) handle retries.
