import { NextRequest, NextResponse } from 'next/server';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function nowMs(): number {
  return Date.now();
}

function requestIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export function rateLimitKey(request: NextRequest, scope: string): string {
  return `${scope}:${requestIp(request)}`;
}

export function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): NextResponse | null {
  const now = nowMs();
  const entry = buckets.get(options.key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  entry.count += 1;
  if (entry.count > options.limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  return null;
}
