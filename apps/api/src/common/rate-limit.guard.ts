import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, mixin } from '@nestjs/common';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function RateLimitGuard(limit = 30, windowMs = 60_000) {
  @Injectable()
  class Guard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest<{ ip?: string; headers?: Record<string, string> }>();
      const ip = req.ip || req.headers?.['x-forwarded-for'] || 'local';
      const key = `${context.getClass().name}:${context.getHandler().name}:${ip}`;
      const now = Date.now();
      let b = buckets.get(key);
      if (!b || now > b.resetAt) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      }
      b.count += 1;
      if (b.count > limit) {
        throw new HttpException('Too many requests — slow down.', HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    }
  }
  return mixin(Guard);
}
