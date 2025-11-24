# Testing guide

This repository uses pnpm workspaces and turbo to orchestrate test runs across the backend (NestJS), web (Next.js), and mobile (Expo) apps. The commands below assume dependencies have been installed with `pnpm install` and that a local Postgres instance is reachable via `DATABASE_URL` from `.env`.

## Backend (NestJS)

- Unit and integration suites run with Jest: `pnpm --filter backend test`
- Generate Prisma client before running specs if the schema changed: `pnpm --filter backend prisma:generate`
- Use the root helper to run only backend tests: `pnpm test -- --filter=backend`

The backend suites cover authentication flows (OTP issuance/verification, JWT refresh), listings, messaging, payments, and admin endpoints. Tests expect the Prisma schema to be migrated and will spin up an in-memory Nest application with mocked third-party providers when credentials are absent.

## Web (Next.js)

- Lint/type-check: `pnpm --filter web lint` and `pnpm --filter web typecheck`
- E2E/UI flows with Playwright: `pnpm --filter web test:e2e`

Web tests target login/signup, session refresh, marketplace browsing, and messaging UIs. They rely on the `NEXT_PUBLIC_API_BASE_URL` from `.env.example` pointing at a running backend instance.

## Mobile (Expo)

- Type-checks: `pnpm --filter mobile typecheck`
- Jest/unit snapshots: `pnpm --filter mobile test`

The Expo project consumes shared APIs and stubs push notifications in CI.

## Running everything

To execute all configured checks in the monorepo, run the root scripts:

- `pnpm test` — runs the test suites defined for each package
- `pnpm lint` — executes linting across all apps
- `pnpm typecheck` — type-checks every package
