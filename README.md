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

# bootstrap the backend environment
cp .env.example .env                  # customize DATABASE_URL, JWT secret, etc.
pnpm prisma:generate                  # generate the typed Prisma client

# run the NestJS API on http://localhost:4000
pnpm backend:dev

# run the Next.js web client on http://localhost:3000
pnpm web:dev
```

> **Note**: The mobile app and admin console will be wired up after the core buyer/seller flows stabilize. Until then they exist as documented placeholders inside `docs/`.

### Implemented API surface (alpha)

- `POST /api/v1/auth/register` and `POST /api/v1/auth/login` provide hashed-password registration and JWT-based authentication.
- `GET /api/v1/auth/me` returns the caller profile (requires `Authorization: Bearer <token>`).
- `GET /api/v1/users`, `GET /api/v1/users/:id`, `PATCH /api/v1/users/:id`, and `DELETE /api/v1/users/:id` offer initial admin-style user management backed by Prisma + PostgreSQL.

The Nest app exposes Swagger docs at `/docs` so any additional routes will surface automatically.

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
