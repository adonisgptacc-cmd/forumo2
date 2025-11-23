# API Gateway overview

All backend services are exposed behind a single NestJS API gateway running at `/api/v1`. Each module registers its routes under the shared router to simplify authentication, logging, and documentation.

## REST routes

| Module        | Route prefix        | Highlights |
|---------------|---------------------|------------|
| Auth          | `/auth`             | register, login, refresh token, OTP verify, forgot/reset password |
| Users         | `/users`            | profile fetch/update, trust score, seller reviews |
| KYC           | `/kyc`              | submit docs, check status, admin approval queue |
| Listings      | `/listings`         | CRUD, upload images, variants, search filters |
| Auctions      | `/auctions`         | create auctions, place bids, cancel, admin overrides |
| Orders        | `/orders`           | create, status transitions, delivery confirmations |
| Escrow        | `/escrow`           | create holdings, release, refund, dispute cases |
| Messaging     | `/messages`         | threads, send message, report conversation |
| Reviews       | `/reviews`          | create review by order, fetch seller reviews |
| Inventory     | `/inventory`        | reserve/release stock, adjustments, damage logging |
| Notifications | `/notifications`    | list notifications, mark read |
| Admin         | `/admin`            | user/listing moderation, disputes, audit logs |

### Admin endpoints

- `GET /admin/kyc/submissions` — list pending and completed verification submissions.
- `PATCH /admin/kyc/submissions/:id` — approve or reject a KYC submission with an optional rejection reason.
- `GET /admin/moderations/listings` — queue of listings awaiting human review.
- `PATCH /admin/moderations/listings/:id` — update moderation status and notes for a listing.
- `GET /admin/disputes` — retrieve disputes escalated to staff with aggregated metadata.
- `PATCH /admin/disputes/:id` — move a dispute through review or resolution states with notes.

## WebSocket channels

- `message:new`, `message:typing`, `message:read`
- `auction:update`, `auction:ended`
- `chat:flagged`
- `notification:new`

WebSocket namespaces are secured using the same JWT as REST calls. Tokens are validated in a `WsJwtGuard` before a socket joins rooms.

## Versioning

- `v1` is the MVP set of routes.
- Breaking changes require `/api/v2` with long-lived deprecation notices.

## Documentation

- OpenAPI spec generated via `@nestjs/swagger` and published at `/docs`.
- Postman collection + Insomnia workspace exported on every release tag.
