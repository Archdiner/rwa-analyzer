// ---------------------------------------------------------------------------
// API route utilities
// ---------------------------------------------------------------------------
// Standard JSON responses + an in-memory token-bucket rate limiter. The limiter
// is process-local, so on serverless it is a best-effort per-instance throttle,
// not a global one - it smooths bursts but does not bound total spend on its
// own. The hard cost ceiling is the global daily budget in `lib/budget.ts`
// (durable in Postgres), which gates every paid external call. For a strict
// global request limit, front this with a shared store (e.g. Upstash Redis).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export function successResponse<T>(data: T, status = 200): NextResponse {
    return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400): NextResponse {
    return NextResponse.json<ApiResponse<never>>({ success: false, error: message }, { status });
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory token bucket)
// ---------------------------------------------------------------------------

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

const MAX_TOKENS = 20; // burst capacity
const REFILL_PER_SEC = 0.5; // ~30/min sustained
const STALE_MS = 300_000;

/**
 * Consumes one token for `key`. Returns whether the request is allowed and how
 * many whole tokens remain. Buckets are pruned lazily once the map grows large.
 */
export function rateLimit(
    key: string,
    maxTokens = MAX_TOKENS,
    refillPerSec = REFILL_PER_SEC,
): { allowed: boolean; remaining: number } {
    const now = Date.now();

    if (buckets.size > 5000) {
        for (const [k, b] of buckets) {
            if (now - b.lastRefill > STALE_MS) buckets.delete(k);
        }
    }

    let bucket = buckets.get(key);
    if (!bucket) {
        bucket = { tokens: maxTokens, lastRefill: now };
        buckets.set(key, bucket);
    }

    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsedSec * refillPerSec);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
        return { allowed: false, remaining: 0 };
    }

    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
}

export function rateLimitedResponse(): NextResponse {
    return errorResponse("Rate limit exceeded. Try again in a moment.", 429);
}

export function getClientIp(request: Request): string {
    // Prefer `x-real-ip`: on Vercel this is set by the platform edge and is not
    // client-spoofable, unlike the left-most `x-forwarded-for` hop (which the
    // caller controls and could rotate to defeat per-IP limiting). Fall back to
    // the first XFF hop only where `x-real-ip` is absent (e.g. local dev).
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return "unknown";
}
