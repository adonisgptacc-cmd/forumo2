import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ModerationQueueService } from '../listings/moderation-queue.service.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationQueue: ModerationQueueService,
  ) {}

  async getStatus(): Promise<{ status: string; timestamp: string; services: Record<string, unknown> }> {
    const [databaseHealthy, queueMetrics] = await Promise.all([
      this.checkDatabase(),
      this.moderationQueue.getMetrics(),
    ]);

    return {
      status: databaseHealthy && queueMetrics.available ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: true,
        database: databaseHealthy,
        cache: queueMetrics.available,
        moderationQueue: queueMetrics,
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error(`Health database check failed: ${message}`);
      return false;
    }
  }
}
