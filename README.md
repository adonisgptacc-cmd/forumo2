# Forumo

Forumo is a pan-African social marketplace that combines traditional e-commerce with auctions, escrow-protected payments, rich messaging, and AI-assisted moderation. This repository contains the multi-platform implementation of the 2025 PRD that spans the web client, mobile experience, backend services, and an admin console.

## Monorepo layout

```
apps/
  backend/      # NestJS API gateway + domain services (Auth, Listings, Orders, etc.)
  web/          # Next.js web client for buyers, sellers, and auctions
  mobile/       # React Native app (Expo) – scaffold coming soon
  admin/        # Admin console (shares the web Next.js runtime)
packages/
  shared/       # Cross-platform utilities, schemas, and generated API clients
  config/       # Shared eslint/tsconfig/prettier rules
```

Each application is independently deployable but shares linting rules, code generation, and design tokens through the `packages/` folder.

## Getting started

```bash
# install pnpm if you don't already have it
npm install -g pnpm

# install all dependencies for the workspace
pnpm install

# run the NestJS API on http://localhost:4000
pnpm backend:dev

# boot the moderation service on http://localhost:5005
cd apps/moderation && uvicorn moderation_service.main:app --reload

# run the Next.js web client on http://localhost:3000
pnpm web:dev
```

> **Note**: The mobile app and admin console will be wired up after the core buyer/seller flows stabilize. Until then they exist as documented placeholders inside `docs/`.

## Database migrations & uploads

1. Copy `.env.example` or export `DATABASE_URL=postgres://user:pass@localhost:5432/forumo`.
2. Apply the Prisma schema (users + listings, variants, and images) with `pnpm --filter backend prisma migrate deploy`.
3. Generate the latest Prisma client for the NestJS API via `pnpm --filter backend prisma:generate` whenever the schema changes.
4. Local uploads are written to `apps/backend/uploads/<bucket>`; set `UPLOADS_BUCKET` to mirror your S3 bucket name and point the Nest API at a MinIO/S3 endpoint if desired.
5. Listing image uploads use in-process memory storage plus a background write to disk. In production swap the `StorageService` implementation for signed URL uploads and ensure AI moderation jobs consume the queue exposed by `ModerationQueueService`.
6. The Python moderation microservice lives in `apps/moderation`. Point `MODERATION_SERVICE_URL` (default `http://localhost:5005`) at the FastAPI instance so that listing and image uploads are automatically scanned before publication.

## Auth & OTP configuration

- Set `JWT_SECRET` (and optionally `JWT_TTL`) for API-issued bearer tokens used by the web and admin clients.
- Configure rate limits and expirations with `OTP_TTL`, `OTP_DEVICE_RATE_LIMIT`, and `OTP_DEVICE_RATE_WINDOW`.
- Email OTPs are delivered via Mailgun. Provide `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `MAILGUN_EMAIL_FROM` (default `no-reply@forumo.dev`). Override the region base with `MAILGUN_API_BASE` (e.g., `https://api.eu.mailgun.net`) if needed.
- SMS OTPs go through AWS SNS. Provide `SNS_REGION`, `SNS_ACCESS_KEY_ID`, and `SNS_SECRET_ACCESS_KEY`, plus optional `SNS_SMS_SENDER_ID` for branded messaging where supported. Missing or invalid credentials fall back to a local simulator for development.
- The Next.js client reads `NEXT_PUBLIC_API_BASE_URL` to call the NestJS API and `NEXTAUTH_SECRET` for session integrity. Login/sign-up forms persist the issued JWT and user profile to `localStorage` so subsequent REST calls can reuse the bearer token.
- `.env.example` in the repo root contains all of the variables above plus API mock toggles for local testing. Copy it to `.env` when bootstrapping a new environment.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) – end-to-end systems design.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) – MVP, V1, and V2 delivery plan derived from the PRD.
- [`docs/API-GATEWAY.md`](docs/API-GATEWAY.md) – HTTP and WebSocket route overview.

## Code style & tooling

- TypeScript everywhere.
- ESLint + Prettier (shared configs live under `packages/config`).
- pnpm workspaces with scripts defined in the root `package.json`.
- Husky + lint-staged (coming soon) for pre-commit consistency.

## License

[MIT](LICENSE)
