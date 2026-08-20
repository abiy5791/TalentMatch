import {
  CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface RateLimit {
  /** Requests allowed per window, per caller. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Cap how often one caller may hit a route.
 *
 * Reach for this on the handful of routes that accept work from strangers —
 * everything else already costs an account.
 */
export const Throttle = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } as RateLimit);

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * A fixed-window counter held in memory.
 *
 * Deliberately not distributed: this instance protects this process, which is
 * the right shape for a single-container deployment and honest about its limit.
 * Behind more than one replica, or anywhere the client IP is worth spoofing,
 * this belongs in Redis or at the edge — the guard is the enforcement point to
 * swap, not something callers depend on.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastPrune = Date.now();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<RateLimit>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule) return true;

    const request = context.switchToHttp().getRequest();
    const key = `${context.getClass().name}.${context.getHandler().name}:${this.callerOf(request)}`;
    const now = Date.now();
    this.prune(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > rule.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      const response = context.switchToHttp().getResponse();
      response?.setHeader?.('Retry-After', String(retryAfter));
      throw new HttpException(
        `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /**
   * A signed-in caller is counted as themselves; everyone else by address.
   *
   * `trust proxy` is off, so `req.ip` is the socket peer and not a header a
   * caller can set. Behind a load balancer that has to be configured
   * deliberately — quietly trusting X-Forwarded-For would let anyone reset
   * their own counter.
   */
  private callerOf(request: any): string {
    if (request.user?.sub) return `user:${request.user.sub}`;
    return `ip:${request.ip || request.socket?.remoteAddress || 'unknown'}`;
  }

  /** Windows are short, so expired buckets are dropped on a lazy pass. */
  private prune(now: number) {
    if (now - this.lastPrune < 60_000) return;
    this.lastPrune = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
