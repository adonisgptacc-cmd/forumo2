import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type Redis from "ioredis";

import { CACHE_NAMESPACE, CACHE_REDIS } from "./cache.constants";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_REDIS) private readonly redis: Redis) {}

  async onModuleInit(): Promise<void> {
    if (this.redis.status !== "wait") {
      return;
    }
    try {
      await this.redis.connect();
    } catch (error) {
      this.logRedisFailure("connect", error);
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.redis.get(this.namespaced(key));
      if (value === null) {
        return undefined;
      }
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        this.logger.warn(
          `Discarding malformed cache entry for ${key}: ${this.errorMessage(error)}`,
        );
        await this.delete(key);
        return undefined;
      }
    } catch (error) {
      this.logRedisFailure("read", error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      await this.delete(key);
      return;
    }
    try {
      await this.redis.set(
        this.namespaced(key),
        JSON.stringify(value),
        "PX",
        Math.ceil(ttlMs),
      );
    } catch (error) {
      this.logRedisFailure("write", error);
    }
  }

  async delete(key: string): Promise<number> {
    try {
      return await this.redis.del(this.namespaced(key));
    } catch (error) {
      this.logRedisFailure("delete", error);
      return 0;
    }
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    try {
      let cursor = "0";
      let deleted = 0;
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          `${this.namespaced(prefix)}*`,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await this.redis.unlink(...keys);
        }
      } while (cursor !== "0");
      return deleted;
    } catch (error) {
      this.logRedisFailure("invalidate", error);
      return 0;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === "wait" || this.redis.status === "end") {
      this.redis.disconnect();
      return;
    }
    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.warn(
        `Redis cache shutdown failed: ${this.errorMessage(error)}`,
      );
      this.redis.disconnect();
    }
  }

  private namespaced(key: string): string {
    return `${CACHE_NAMESPACE}${key}`;
  }

  private logRedisFailure(operation: string, error: unknown): void {
    this.logger.warn(
      `Redis cache ${operation} failed; continuing without cache: ${this.errorMessage(error)}`,
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
