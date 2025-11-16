# Roadmap

## MVP (Weeks 0-10)

- [ ] Auth & User profiles (email/password, OTP, device logs)
- [ ] Listings CRUD with media uploads + AI moderation webhooks
- [ ] Search (PostgreSQL full-text + filters)
- [ ] Orders + Escrow checkout (Stripe test mode)
- [ ] Messaging (1:1 chat, attachments, moderation flags)
- [ ] Reviews + trust score seed values
- [ ] Basic admin console (KYC queue, listing approvals, dispute view)
- [ ] React Native shell with browsing + messaging read-only

## V1 (Months 3-6 post-launch)

- [ ] Auctions engine (proxy bidding, anti-sniping, live updates)
- [ ] Inventory engine (reservations, bundles, alerts)
- [ ] Delivery integrations (Pargo, The Courier Guy)
- [ ] Push notifications (Expo + web push)
- [ ] Advanced admin analytics (PostHog, KPI dashboards)
- [ ] Payment reconciliation + payout approvals

## V2 (Months 6-12)

- [ ] Marketplace groups / community hubs
- [ ] Seller subscription tiers
- [ ] Wallet & stored balance
- [ ] AI dynamic pricing recommendations
- [ ] Crypto + multi-currency support
- [ ] Automated risk scoring + ML feedback loop

## Cross-cutting initiatives

| Theme          | Description |
|----------------|-------------|
| Observability  | OpenTelemetry, Grafana dashboards, SLOs.
| Compliance     | POPIA + CPA + ECTA documentation, DPA checklists.
| Security       | Pen-testing schedule, dependency scanning, secret rotation.
| QA Automation  | Unit + integration coverage, Cypress suites, mobile snapshot tests.
