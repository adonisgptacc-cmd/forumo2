# Forumo Architecture

This document translates the PRD into a pragmatic architecture that can scale from an MVP to a continent-wide marketplace.

## High-level view

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web (Next)  │     │ Mobile (RN)  │     │ Admin (Next) │
└────────┬─────┘     └──────┬───────┘     └──────┬───────┘
         │  GraphQL/REST    │                   │
         ▼                  ▼                   ▼
                 ┌───────────────────────┐
                 │   API Gateway (Nest) │
                 │  Auth, Listings, etc │
                 └──────────┬───────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Domain microservices (Nest modules)                   │
│  • Auth & Users                                        │
│  • Listings & Search                                   │
│  • Orders, Escrow, Payments                            │
│  • Auctions                                            │
│  • Messaging (Socket.IO)                               │
│  • Reviews & Trust                                     │
│  • Notifications                                       │
│  • KYC & Compliance                                    │
│  • Inventory                                           │
│  • Admin tooling                                       │
└──────────────────────┬─────────────────────────────────┘
                       ▼
           ┌────────────────────┐
           │ PostgreSQL + Redis │
           └────────────────────┘
```

## Technology choices

| Concern              | Tech                                    | Notes |
|----------------------|-----------------------------------------|-------|
| API & domain logic   | NestJS (modular monolith to start)      | Module boundaries mirror PRD microservices. |
| Database             | PostgreSQL + Prisma ORM                 | Prisma migrations keep schemas versioned. |
| Search               | PostgreSQL full-text → OpenSearch later | Keep adapters to swap engines. |
| Caching / queues     | Redis + BullMQ                          | Shared connection factory per module. |
| Realtime messaging   | Socket.IO                               | Works for chat + auctions + notifications. |
| File storage         | AWS S3 compatible (MinIO locally)       | Uploads proxied through backend for validation. |
| Web                  | Next.js 15 (app router)                 | Seller dashboards + buyer flows + admin. |
| Mobile               | Expo / React Native                     | Shares API layer + design system. |
| Infra                | Docker + Kubernetes                     | CI builds images; Helm charts tracked in `/infra`. |

## Module boundaries

Each Nest module maps to a domain context. Modules interact via service interfaces and emit domain events through an internal event bus (simple RxJS Subject now, Kafka later).

- **AuthModule** – registration, login, OTP, device fingerprint capture.
- **UsersModule** – user profiles, trust score aggregation, reviews.
- **ListingsModule** – CRUD, photo uploads, AI moderation hooks.
- **AuctionsModule** – bidding engine, anti-sniping scheduler, WebSocket broadcasts.
- **OrdersModule** – order lifecycle, delivery methods, integration with EscrowModule.
- **EscrowModule** – funds ledger, payout jobs, dispute workflows.
- **MessagingModule** – conversation threads, attachments, moderation queue.
- **KycModule** – submission intake, OCR pipeline, manual review queue.
- **NotificationsModule** – fan-out to email/SMS/push/in-app via Bull workers.
- **AdminModule** – role-based dashboards, moderation tools, audit trail surface.

## Local development topology

- `docker-compose.dev.yml` (coming soon) starts PostgreSQL, Redis, MinIO, and Mailpit.
- Backend exposes REST under `http://localhost:4000/api/v1` and a Socket.IO server at `ws://localhost:4000/ws`.
- Next.js web app proxies API requests through `/api/*` to avoid CORS headaches during dev.

## Security controls baked in from day one

1. **Zero trust defaults** – every request validated via Nest guards; RBAC claims minted in JWTs.
2. **Audit logging** – decorator-based logger that records actor, entity, and payload diff to `AuditLogs`.
3. **PII handling** – S3 buckets enforce server-side encryption; signed URLs expire within 5 minutes.
4. **Fraud detection** – risk-scoring middleware surfaces suspicious payments to the admin console.
5. **Secrets** – `.env` only for dev; production uses AWS Secrets Manager.

## Deployment strategy

1. GitHub Actions builds Docker images for each app on every push to `main`.
2. Images are pushed to ECR with semantic tags (`backend:0.1.0`).
3. ArgoCD/Flux watches Helm charts in `/infra/k8s` and performs progressive rollout with health checks.
4. Post-deploy smoke tests hit `/health` endpoints and verify queue + database connectivity.

## Observability

- **Tracing** – OpenTelemetry SDK instrumented in the Nest and Next runtimes.
- **Metrics** – Prometheus scrapes `/metrics`; Grafana dashboards track SLA.
- **Error reporting** – Sentry DSNs configured per environment.

## Next steps

- Flesh out Prisma schema + migrations.
- Implement Auth + Listings + Orders for MVP.
- Bootstrap AI moderation service (Python microservice) and integrate via REST hooks.
