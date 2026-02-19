/**
 * Simple in-memory sliding-window rate limiter.
 * No external deps — suitable for single-process deployments.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

interface RateLimitConfig {
  /** Max requests per window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Check rate limit for a given key (IP, address, etc).
 * Returns whether the request is allowed and remaining quota.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - config.windowMs;

  cleanup(config.windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.max) {
    const oldest = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldest + config.windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.max - entry.timestamps.length,
    resetMs: config.windowMs,
  };
}

/** Pre-configured limiters for different route types */
export const RATE_LIMITS = {
  /** Auth routes: 10 per minute */
  auth: { max: 10, windowMs: 60_000 },
  /** Write operations (POST/PATCH/DELETE): 30 per minute */
  write: { max: 30, windowMs: 60_000 },
  /** Read operations (GET): 120 per minute */
  read: { max: 120, windowMs: 60_000 },
  /** On-chain operations: 10 per minute */
  onchain: { max: 10, windowMs: 60_000 },
} as const;

/**
 * Extract a rate-limit key from a Next.js request.
 * Uses x-forwarded-for header (behind proxy) or falls back to a default key.
 */
export function getRateLimitKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}

/**
 * Returns a 429 Response if rate limited, or null if allowed.
 */
export function rateLimitResponse(
  request: Request,
  prefix: string,
  config: RateLimitConfig = RATE_LIMITS.write
): Response | null {
  const key = getRateLimitKey(request, prefix);
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        retryAfterMs: result.resetMs,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(result.resetMs / 1000)),
        },
      }
    );
  }

  return null;
}
