import { Injectable } from '@nestjs/common';
import { getMetricsRegistry } from '../../telemetry/metrics.js';

@Injectable()
export class MetricsService {
  async getSnapshot(): Promise<string> {
    const registry = getMetricsRegistry();
    return registry.metrics();
  }
}
