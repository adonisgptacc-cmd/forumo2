# Forumo - Claude Code Project Guide

## Project Overview

Forumo is a **pan-African social marketplace** combining e-commerce with auctions, escrow-protected payments, messaging, and AI-assisted moderation. Currently in MVP phase with core buyer/seller flows, listings, messaging, and basic admin console.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend Web** | Next.js 15, React 18, TypeScript, TailwindCSS 4.1 |
| **Mobile** | Expo 50, React Native 0.73, React Navigation 7 |
| **Backend** | NestJS 10.4, Prisma 5.20, PostgreSQL 16, Redis 7 |
| **Moderation** | FastAPI 0.115 (Python microservice) |
| **Build** | pnpm 9.1, Turbo 2.0 |
| **Testing** | Jest, Playwright, Detox |

## Monorepo Structure

```
apps/
├── backend/          # NestJS API (localhost:4000)
├── web/              # Next.js frontend (localhost:3000)
├── mobile/           # Expo React Native app
├── moderation/       # Python FastAPI moderation service
└── admin/            # Admin console (placeholder)

packages/
├── shared/           # Cross-platform types, API client
├── design-system/    # Shared React components
└── config/           # ESLint, TypeScript, Prettier configs

docs/                 # ARCHITECTURE.md, ROADMAP.md, TESTING.md, API-GATEWAY.md
```

## Common Commands

```bash
# Development
pnpm dev              # Start all services in parallel
pnpm dev:backend      # NestJS only (http://localhost:4000)
pnpm dev:web          # Next.js only (http://localhost:3000)

# Database
pnpm db:setup         # Migrate + seed
pnpm db:migrate       # Apply migrations
pnpm db:seed          # Run seeders
pnpm db:studio        # Open Prisma Studio

# Docker (required for local dev)
pnpm docker:up        # Start PostgreSQL, Redis, MinIO, Mailpit
pnpm docker:down      # Stop services
pnpm docker:logs      # View logs

# Testing
pnpm test             # All test suites
pnpm test:e2e         # Playwright E2E
pnpm test:coverage    # Coverage reports

# Code Quality
pnpm lint             # ESLint all apps
pnpm lint:fix         # Auto-fix issues
pnpm format           # Prettier format
pnpm typecheck        # TypeScript validation

# Build
pnpm build            # Production build all apps
```

## Backend Modules

The NestJS backend uses a modular monolith pattern:

- **AuthModule** - Registration, login, OTP, JWT, device fingerprint
- **UsersModule** - Profiles, trust scores
- **ListingsModule** - CRUD, photo uploads, AI moderation hooks
- **OrdersModule** - Order lifecycle, delivery, escrow
- **ReviewsModule** - Seller reviews + trust aggregation
- **MessagingModule** - Conversations, attachments (Socket.IO)
- **AdminModule** - Dashboards, moderation tools, audit trails
- **StorageModule** - File upload/download (MinIO)
- **ObservabilityModule** - Metrics, tracing (OpenTelemetry)
- **HealthModule** - Liveness/readiness probes

## Local Services

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | localhost:5432 | forumo / forumo |
| pgAdmin | http://localhost:5050 | admin@local.test / password |
| Redis | localhost:6379 | - |
| MinIO API | http://localhost:9000 | minioadmin / minioadmin |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| Mailpit | http://localhost:8025 | - |
| API Docs | http://localhost:4000/docs | - |

## Key Files

- `apps/backend/prisma/schema.prisma` - Database schema
- `apps/backend/src/config/config.schema.ts` - Environment validation (Zod)
- `docker-compose.dev.yml` - Local dev services
- `turbo.json` - Build pipeline configuration
- `.env.example` - Environment variables template

## Development Guidelines

### Before Making Changes
1. Run `pnpm docker:up` to start required services
2. Run `pnpm db:migrate` if there are pending migrations
3. Use `pnpm dev` to start the development servers

### Code Style
- TypeScript strict mode is enforced
- Zod for runtime validation
- Follow existing module patterns in `apps/backend/src/modules/`
- Use shared types from `packages/shared`

### Testing Requirements
- Write Jest unit tests for backend services
- Write Playwright tests for web E2E flows
- Run `pnpm test` before committing

### Database Changes
1. Modify `apps/backend/prisma/schema.prisma`
2. Run `pnpm db:migrate` to generate migration
3. Update seed data in `apps/backend/prisma/seed.ts` if needed

### Adding New Backend Modules
1. Create module in `apps/backend/src/modules/<name>/`
2. Include: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`
3. Add DTOs with Zod validation
4. Register in `apps/backend/src/app.module.ts`

## API Conventions

- Base URL: `/api/v1`
- Authentication: JWT Bearer token
- WebSocket: `ws://localhost:4000/ws`
- Swagger docs auto-generated at `/docs`

## Environment Setup

1. Copy `.env.example` to `.env` in root and each app
2. Run `pnpm docker:up` to start infrastructure
3. Run `pnpm db:setup` to initialize database
4. Run `pnpm dev` to start development

## Debugging

- Backend logs: Check terminal running `pnpm dev:backend`
- Database: Use `pnpm db:studio` for Prisma Studio GUI
- Emails: View at http://localhost:8025 (Mailpit)
- API: Use Swagger at http://localhost:4000/docs
