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
pnpm dev:backend

# boot the moderation service on http://localhost:5005
cd apps/moderation && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && \
  uvicorn moderation_service.main:app --reload

# run the Next.js web client on http://localhost:3000
pnpm dev:web
```

> **Note**: The mobile app and admin console will be wired up after the core buyer/seller flows stabilize. Until then they exist as documented placeholders inside `docs/`.

## Getting Started - Local Development

Spin up the full local stack with Docker, install dependencies, run pending database migrations, and start the monorepo processes in parallel:

```bash
pnpm docker:up
pnpm install
pnpm db:migrate
pnpm dev
```

### Service URLs & Credentials

- PostgreSQL: `localhost:5432` (user: `forumo`, password: `forumo`, db: `forumo`)
- pgAdmin: http://localhost:5050 (email: `admin@local.test`, password: `password`)
- Redis: `localhost:6379`
- MinIO API: http://localhost:9000 (key: `minioadmin`, secret: `minioadmin`)
- MinIO Console: http://localhost:9001
- Mailpit SMTP: `localhost:1025`, Web UI: http://localhost:8025

### Troubleshooting Docker

- **Port conflicts**: stop other services using 5432/6379/9000/9001/1025/8025/5050 or override ports in `docker-compose.dev.yml`.
- **Volume permissions**: ensure the `docker/*-data` directories are writable by Docker; removing them and letting Docker recreate can resolve stale permissions.
- **Cold start failures**: restart individual services with `docker-compose -f docker-compose.dev.yml restart <service>` to retry initialization scripts like `pg_stat_statements`.

### Environment configuration

- Copy `.env.example` files (root + each app) to `.env` via `./scripts/setup.sh`; the script also installs dependencies and runs migrations.
- Environment variable precedence: explicit shell exports override `.env` files, which override hard-coded defaults in code/config schemas.
- Validate required entries before boot: `./scripts/validate-env.sh apps/backend/.env`.

### Architecture Diagram

```mermaid
flowchart LR
  Web[Next.js web] -->|REST/WS| Backend[NestJS API]
  Mobile[React Native] -->|REST/WS| Backend
  Backend -->|SQL| Postgres[(PostgreSQL)]
  Backend -->|Cache/Queues| Redis[(Redis)]
  Backend -->|S3 API| MinIO[(MinIO)]
  Backend -->|SMTP| Mailpit[Mailpit]
  Postgres --> pgAdmin[pgAdmin]
```

### Observability

- Health: `GET /api/v1/health`, `GET /api/v1/health/live`, `GET /api/v1/health/ready`
- Metrics: `GET /metrics` (API-key gated outside development)
- Dashboards & alerts: see `monitoring/dashboards` and `monitoring/alerts` for Grafana and Prometheus examples.

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
- [`docs/TESTING.md`](docs/TESTING.md) – how to run backend, web, and mobile test suites.

## Code style & tooling

- TypeScript everywhere.
- ESLint + Prettier (shared configs live under `packages/config`).
- pnpm workspaces with scripts defined in the root `package.json`.
- Husky + lint-staged (coming soon) for pre-commit consistency.

## License

[MIT](LICENSE)
