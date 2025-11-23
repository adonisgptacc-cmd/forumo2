import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const metrics = {
  httpRequestsTotal: new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  }),
  httpRequestDurationMs: new Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [10, 50, 100, 250, 500, 1000, 2500],
    registers: [registry],
  }),
  dbQueryDurationMs: new Histogram({
    name: 'db_query_duration_ms',
    help: 'Database query duration by query type',
    labelNames: ['operation'],
    buckets: [5, 10, 25, 50, 100, 250, 500],
    registers: [registry],
  }),
  cacheHitRatio: new Gauge({
    name: 'cache_hit_ratio',
    help: 'Cache hit ratio gauge',
    registers: [registry],
  }),
  activeConnections: new Gauge({
    name: 'active_connections',
    help: 'Active connections gauge',
    labelNames: ['type'],
    registers: [registry],
  }),
  backgroundJobsProcessed: new Counter({
    name: 'background_jobs_processed_total',
    help: 'Background jobs processed by type and status',
    labelNames: ['job', 'status'],
    registers: [registry],
  }),
};

export const getMetricsRegistry = () => registry;
