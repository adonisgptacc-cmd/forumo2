import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Hit {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Hit>();
  /** Explicit lockouts: key → expiry timestamp */
  private readonly lockouts = new Map<string, number>();

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

  /**
   * Returns the current failure count for a key within its active window.
   * Returns 0 if the window has expired.
   */
  getCount(key: string, windowMs: number): number {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || now - existing.windowStart >= windowMs) return 0;
    return existing.count;
  }

  /** Locks a key for the given duration (ms). Any subsequent isLocked() call will return true. */
  lock(key: string, durationMs: number): void {
    this.lockouts.set(key, Date.now() + durationMs);
  }

  /** Returns true if the key is currently locked. Cleans up expired entries automatically. */
  isLocked(key: string): boolean {
    const expiry = this.lockouts.get(key);
    if (expiry === undefined) return false;
    if (Date.now() >= expiry) {
      this.lockouts.delete(key);
      return false;
    }
    return true;
  }
}
