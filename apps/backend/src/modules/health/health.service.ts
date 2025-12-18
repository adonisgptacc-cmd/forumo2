import { performance } from 'node:perf_hooks';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationQueueService } from "../listings/moderation-queue.service";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationQueue: ModerationQueueService,
    private readonly configService: ConfigService,
  ) {}

  async getStatus() {
    const [database, queueMetrics, redis, minio] = await Promise.all([
      this.checkDatabase(),
      this.moderationQueue.getMetrics(),
      this.checkRedis(),
      this.checkMinio(),
    ]);

    return {
      status: database.status === 'up' && redis.status === 'up' && minio.status === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database,
        redis,
        minio,
        memory: this.getMemorySnapshot(),
        moderationQueue: queueMetrics,
      },
    };
  }

  private async checkDatabase() {
    const started = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', responseTime: Math.round(performance.now() - started) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error(`Health database check failed: ${message}`);
      return { status: 'down', responseTime: Math.round(performance.now() - started), error: message };
    }
  }

  private async checkRedis() {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const started = performance.now();
    const client = new IORedis(redisUrl, { lazyConnect: true });
    try {
      await client.connect();
      await client.ping();
      return { status: 'up', responseTime: Math.round(performance.now() - started) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis unavailable';
      this.logger.error(`Redis health failed: ${message}`);
      return { status: 'down', responseTime: Math.round(performance.now() - started), error: message };
    } finally {
      await client.quit().catch(() => undefined);
    }
  }

  private async checkMinio() {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT') ?? 'localhost';
    const port = this.configService.get<number>('MINIO_PORT') ?? 9000;
    const useSsl = this.configService.get<boolean>('MINIO_USE_SSL') ?? false;
    const scheme = useSsl ? 'https' : 'http';
    const started = performance.now();

    try {
      const response = await fetch(`${scheme}://${endpoint}:${port}/minio/health/live`);
      const healthy = response.ok;
      return {
        status: healthy ? 'up' : 'down',
        responseTime: Math.round(performance.now() - started),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MinIO unavailable';
      this.logger.error(`MinIO health failed: ${message}`);
      return { status: 'down', responseTime: Math.round(performance.now() - started), error: message };
    }
  }

  private getMemorySnapshot() {
    const { heapUsed, heapTotal } = process.memoryUsage();
    return {
      heapUsed: `${Math.round(heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(heapTotal / 1024 / 1024)}MB`,
    };
  }
}
