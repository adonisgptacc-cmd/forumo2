import { ThrottlerStorage, ThrottlerStorageRecord } from '@nestjs/throttler';
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import type { Redis } from 'ioredis';

/**
 * Redis-backed ThrottlerStorage using rate-limiter-flexible.
 * Falls back to an in-memory insurance limiter if Redis is temporarily unreachable.
 */
export class ThrottlerStorageRedis implements ThrottlerStorage {
  private readonly limiters = new Map<string, RateLimiterRedis>();

  constructor(private readonly redis: Redis) {}

  private getLimiter(
    name: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): RateLimiterRedis {
    const key = `${name}:${ttl}:${limit}:${blockDuration}`;
    if (!this.limiters.has(key)) {
      this.limiters.set(
        key,
        new RateLimiterRedis({
          storeClient: this.redis,
          keyPrefix: `throttler:${name}`,
          points: limit,
          duration: ttl,
          blockDuration,
          insuranceLimiter: new RateLimiterMemory({
            points: limit,
            duration: ttl,
            blockDuration,
          }),
        }),
      );
    }
    return this.limiters.get(key)!;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const limiter = this.getLimiter(throttlerName, ttl, limit, blockDuration);
    try {
      const res = await limiter.consume(key);
      return {
        totalHits: res.consumedPoints,
        timeToExpire: Math.ceil(res.msBeforeNext / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        const blockSecs = err.msBlockBeforeNext > 0
          ? Math.ceil(err.msBlockBeforeNext / 1000)
          : Math.ceil(err.msBeforeNext / 1000);
        return {
          totalHits: (err.consumedPoints ?? limit) + 1,
          timeToExpire: Math.ceil(err.msBeforeNext / 1000),
          isBlocked: true,
          timeToBlockExpire: blockSecs,
        };
      }
      throw err;
    }
  }
}
