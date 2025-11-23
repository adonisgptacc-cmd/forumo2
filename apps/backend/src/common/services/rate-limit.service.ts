import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Hit {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Hit>();

  enforce(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (existing && now - existing.windowStart < windowMs) {
      if (existing.count >= limit) {
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
      existing.count += 1;
      return;
    }

    this.buckets.set(key, { count: 1, windowStart: now });
  }
}
