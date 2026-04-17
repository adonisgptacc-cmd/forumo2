# Forumo

A peer-to-peer marketplace with escrow-protected payments, seller verification, and in-app messaging — built for trust-first commerce between individuals.

## What it does

- Buyers discover and purchase items via fixed-price listings or auctions, with funds held in escrow until delivery is confirmed
- Sellers create verified storefronts, manage inventory, and receive offers — getting paid only when the buyer confirms receipt
- Messaging, offer negotiation, and dispute resolution are built into the order flow
- A moderation pipeline reviews listings for policy compliance before they go live
- Admins manage KYC submissions, flagged listings, and escrow disputes via a built-in dashboard

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend API | NestJS 10, Prisma 5, PostgreSQL 16, Redis 7, BullMQ, Socket.IO |
| Frontend | Next.js 15, React 18, TailwindCSS 4, NextAuth v4, TanStack Query v5 |
| Payments | Stripe (escrow + capture) |
| Storage | MinIO (S3-compatible) |
| Moderation | FastAPI (Python 3) — separate service |
| Mobile | Expo 50 / React Native 0.73 (pre-alpha — not functional yet) |
| Shared | Zod schemas + typed API client (`packages/shared`) |
| Infra | Docker Compose (dev), Kubernetes (planned) |

## Getting started

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [pnpm 9+](https://pnpm.io/installation)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 1. Clone the repo

```bash
git clone https://github.com/adonisgptacc-cmd/forumo2.git
cd forumo2
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
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

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| API docs (Swagger) | http://localhost:4000/docs |
| MinIO console | http://localhost:9001 |
| Email viewer (Mailpit) | http://localhost:8025 |

---

## Environment variables

### `apps/backend/.env`

| Variable | What it does | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_SECRET` | Signs access tokens — **change in production** | Yes |
| `JWT_EXPIRES_IN` | Access token TTL (default: `7d`) | Yes |
| `STRIPE_SECRET_KEY` | Stripe API key for payment capture | Yes |
| `MINIO_ENDPOINT` | MinIO / S3 host | Yes |
| `MINIO_ACCESS_KEY` | MinIO access key | Yes |
| `MINIO_SECRET_KEY` | MinIO secret key | Yes |
| `SMTP_HOST` | SMTP server for transactional email | Yes |
| `FRONTEND_URL` | Allowed CORS origin | Yes |
| `MAILGUN_API_KEY` | Mailgun for email — falls back to SMTP if absent | Optional |
| `SNS_ACCESS_KEY_ID` | AWS SNS for SMS OTP — falls back to dev simulator | Optional |
| `SNS_SECRET_ACCESS_KEY` | AWS SNS secret | Optional |
| `GOOGLE_CLIENT_ID` | Google OAuth — omit to disable | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Optional |

### `apps/web/.env`

| Variable | What it does | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | Yes |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | Yes |
| `NEXTAUTH_URL` | NextAuth canonical URL | Yes |
| `NEXTAUTH_SECRET` | NextAuth session signing key — **change in production** | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key for checkout | Yes |
| `NEXT_PUBLIC_USE_API_MOCKS` | Enable frontend mocks (development only) | Optional |

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

- **Search filtering is incomplete** — sort and category filters are accepted by the API but not yet applied
- **KYC submission UI is missing** — sellers cannot complete verification through the frontend (backend API works)
- **Escrow dispute UI is missing** — dispute resolution requires direct API calls
- **Cart variant integration is incomplete** — variant selection does not correctly update the cart payload
- **Mobile app is pre-alpha** — navigation scaffold only, no screens implemented
- **No error boundaries** — a component error causes a blank page rather than a graceful fallback
- **No silent token refresh** — JWTs expire after 7 days; the next API call silently fails rather than prompting re-login

---

## Roadmap

**Next (before public launch)**
- Search with working sort + category filters
- KYC document submission form
- Escrow dispute UI
- Error boundaries on all routes
- Cart variant payload fix

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
