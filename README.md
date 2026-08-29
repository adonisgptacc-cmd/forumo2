# Forumo

A peer-to-peer marketplace with escrow-protected payments, seller verification, and in-app messaging — built for trust-first commerce between individuals.

## What it does

- Buyers discover and purchase items via fixed-price listings or auctions, with funds held in escrow until delivery is confirmed
- Sellers create verified storefronts, manage inventory, and receive offers — getting paid only when the buyer confirms receipt
- Messaging, offer negotiation, and dispute resolution are built into the order flow
- A moderation pipeline reviews listings for policy compliance before they go live
- Admins manage KYC submissions, flagged listings, and escrow disputes via a built-in dashboard

## Tech stack

| Layer       | Technology                                                          |
| ----------- | ------------------------------------------------------------------- |
| Backend API | NestJS 10, Prisma 5, PostgreSQL 16, Redis 7, BullMQ, Socket.IO      |
| Frontend    | Next.js 15, React 18, TailwindCSS 4, NextAuth v4, TanStack Query v5 |
| Payments    | Stripe (escrow + capture)                                           |
| Storage     | MinIO (S3-compatible)                                               |
| Moderation  | FastAPI (Python 3) — separate service                               |
| Mobile      | Expo 50 / React Native 0.73 (pre-alpha — not functional yet)        |
| Shared      | Zod schemas + typed API client (`packages/shared`)                  |
| Infra       | Docker Compose (dev), Kubernetes (planned)                          |

## Getting started

### Prerequisites

- [Node.js 22.23.2](https://nodejs.org) (see `.node-version`)
- [pnpm 11.19.0](https://pnpm.io/installation) (activated from `packageManager`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 1. Clone the repo

```bash
git clone https://github.com/adonisgptacc-cmd/forumo2.git
cd forumo2
```

### 2. Install dependencies

```bash
corepack enable
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

The defaults work for local development without any changes. See [Environment variables](#environment-variables) if you need to customise anything.

### 4. Start local infrastructure

```bash
pnpm docker:up
```

This starts PostgreSQL, Redis, MinIO, Mailpit, and the moderation service. Wait ~30 seconds for all services to become healthy.

### 5. Run database migrations and seed data

```bash
pnpm db:setup
```

### 6. Start the development servers

```bash
pnpm dev
```

| Service                | URL                        |
| ---------------------- | -------------------------- |
| Web app                | http://localhost:3000      |
| Admin dashboard        | http://localhost:3001      |
| Backend API            | http://localhost:4000      |
| API docs (Swagger)     | http://localhost:4000/docs |
| Moderation service     | http://localhost:5005      |
| MinIO console          | http://localhost:9001      |
| Email viewer (Mailpit) | http://localhost:8025      |

---

## Environment variables

All variables live in a single `.env` file at the repo root. Copy `.env.example` to `.env` — every variable is documented with a comment in that file. The most important ones:

### Backend

| Variable                 | What it does                                          | Required |
| ------------------------ | ----------------------------------------------------- | -------- |
| `DATABASE_URL`           | PostgreSQL connection string                          | Yes      |
| `REDIS_URL`              | Redis connection string                               | Yes      |
| `JWT_SECRET`             | Signs access tokens — **change in production**        | Yes      |
| `JWT_TTL`                | Access token TTL in seconds (default: `900`)          | Yes      |
| `STRIPE_SECRET_KEY`      | Stripe API key for payment capture                    | Yes      |
| `PAYSTACK_SECRET_KEY`    | Paystack API key for NGN/GHS/KES/ZAR payments         | Yes      |
| `MINIO_ENDPOINT`         | MinIO / S3 host                                       | Yes      |
| `MINIO_ACCESS_KEY`       | MinIO access key                                      | Yes      |
| `MINIO_SECRET_KEY`       | MinIO secret key                                      | Yes      |
| `UPLOADS_BUCKET`         | S3 bucket name for user uploads                       | Yes      |
| `MODERATION_SERVICE_URL` | URL of the moderation microservice                    | Yes      |
| `FRONTEND_URL`           | Used for CORS and email callback links                | Yes      |
| `MAILGUN_API_KEY`        | Mailgun for email — omit to use Mailpit dev simulator | Optional |
| `SNS_ACCESS_KEY_ID`      | AWS SNS for SMS OTP — omit to use dev simulator       | Optional |
| `GOOGLE_CLIENT_ID`       | Google OAuth — omit to disable                        | Optional |

### Frontend

| Variable                             | What it does                                               | Required |
| ------------------------------------ | ---------------------------------------------------------- | -------- |
| `NEXT_PUBLIC_API_BASE_URL`           | Backend API base URL                                       | Yes      |
| `NEXT_PUBLIC_WS_URL`                 | WebSocket server URL for real-time messaging               | Yes      |
| `NEXTAUTH_URL`                       | NextAuth canonical URL                                     | Yes      |
| `NEXTAUTH_SECRET`                    | NextAuth session signing key — **change in production**    | Yes      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key for checkout                             | Yes      |
| `NEXT_PUBLIC_TOS_VERSION`            | Must match backend `TOS_VERSION` env var                   | Yes      |
| `NEXT_PUBLIC_USE_API_MOCKS`          | Enable frontend mocks (development only, never production) | Optional |

---

## Project structure

```
forumo/
├── apps/
│   ├── backend/                 # NestJS API — business logic, REST + WebSocket
│   ├── web/                     # Next.js frontend — buyer, seller, and admin UI
│   ├── mobile/                  # Expo app — pre-alpha, scaffold only
│   └── moderation-service/      # FastAPI service — listing content moderation
├── packages/
│   └── shared/                  # Zod schemas + typed API client shared across apps
├── docs/                        # Architecture, API reference, roadmap
├── scripts/                     # Dev utility scripts (setup, validate-env)
├── docker-compose.yml           # Base service definitions
├── docker-compose.override.yml  # Dev overrides (auto-loaded by Docker Compose)
└── turbo.json                   # Monorepo build orchestration
```

---

## Deployment

> Production deployment is not yet fully documented. The Docker Compose stack covers local development. Kubernetes manifests are planned.

For a minimal production setup:

1. Provision PostgreSQL 16 and Redis 7
2. Deploy MinIO or use an S3-compatible service (AWS S3, Cloudflare R2)
3. Set all environment variables to production values — especially `JWT_SECRET`, `NEXTAUTH_SECRET`, and `STRIPE_SECRET_KEY`
4. Run `pnpm build` then deploy each app as a container (`apps/backend`, `apps/web`, `apps/moderation-service`)

---

## Known issues / limitations

- **Mobile app is pre-alpha** — 27 screens implemented and navigation-wired, but not tested end-to-end against a live backend
- **Seller payout flow (ZAR + Stripe Connect)** — not validated end-to-end

---

## Roadmap

**Next (before public launch)**

- Complete the [minimum viable public-beta checklist](docs/ROADMAP.md#minimum-viable-public-beta-checklist), including clean-checkout CI evidence, critical browser smoke tests, staging deployment rehearsal, and operating/legal sign-offs
- Validate the non-ZAR Stripe Connect payout path end-to-end (ZAR/Paystack payouts already validated and automated)
- Test mobile app against a live backend

**Soon**

- Seller analytics dashboard
- Shipping label generation (Shippo / EasyPost)
- Counter-offer negotiation
- Post-purchase review prompts
- Real-time auction bid updates via WebSocket

**Later**

- Mobile app (React Native / Expo)
- Promoted listings
- Bundle discounts
- Price-drop alerts for wishlisted items

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — end-to-end system design
- [`docs/API-GATEWAY.md`](docs/API-GATEWAY.md) — HTTP and WebSocket route overview
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — full delivery plan
- [`docs/TESTING.md`](docs/TESTING.md) — how to run tests

---

## License

[MIT](LICENSE)
