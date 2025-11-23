import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { metrics } from '../../telemetry/metrics.js';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest();
    const method = request?.method ?? 'UNKNOWN';
    const route = request?.route?.path ?? request?.url ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => this.recordMetrics(method, route, startedAt, 200),
        error: (err) => {
          const status = err?.status ?? 500;
          this.recordMetrics(method, route, startedAt, status);
        },
      }),
    );
  }

  private recordMetrics(method: string, route: string, startedAt: number, status: number) {
    const duration = Date.now() - startedAt;
    metrics.httpRequestsTotal.labels(method, route, String(status)).inc();
    metrics.httpRequestDurationMs.labels(method, route, String(status)).observe(duration);
  }
}
