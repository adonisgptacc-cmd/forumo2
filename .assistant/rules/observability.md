# Observability policy

- Use the existing structured Pino logging pipeline and consistent log levels.
- Propagate correlation or request IDs across service boundaries and asynchronous jobs.
- Log actionable event context, not secrets, tokens, payment data, KYC material, private messages, or full sensitive payloads.
- Add metrics for material business outcomes, latency, error rates, retries, queue health, and dependency failures.
- Define alerts around user impact and service objectives with actionable ownership and runbook context.
- Preserve error causes internally while returning safe, stable errors to clients.
- Reuse the project's OpenTelemetry, Prometheus, Grafana, and Sentry integrations where present; do not create parallel telemetry stacks without approval.
