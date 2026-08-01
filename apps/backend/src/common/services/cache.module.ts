import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import IORedis from "ioredis";

import { CACHE_REDIS } from "./cache.constants";
import { CacheService } from "./cache.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CACHE_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = new IORedis(
          config.get<string>("REDIS_URL") ?? "redis://localhost:6379",
          {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            connectTimeout: 2_000,
            retryStrategy: (attempt) => Math.min(attempt * 100, 1_000),
          },
        );
        redis.on("error", () => undefined);
        return redis;
      },
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
