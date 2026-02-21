/**
 * Rate limiter with two backends:
 * 1) Upstash/Vercel KV REST (durable across cold starts) when configured
 * 2) In-memory sliding window fallback for local/dev
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

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function hasKvBackend(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

async function kvRequest(path: string): Promise<unknown> {
  const res = await fetch(`${KV_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`KV request failed: ${res.status}`);
  }
  return res.json();
}

async function checkRateLimitKv(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const encodedKey = encodeURIComponent(key);
  const windowSec = Math.ceil(config.windowMs / 1000);

  // Increment request count for this window key.
  const incrJson = (await kvRequest(`/incr/${encodedKey}`)) as {
    result?: number | string;
  };
  const count = Number(incrJson.result ?? 0);

  // First request in this key: set TTL for the window.
  if (count === 1) {
    await kvRequest(`/expire/${encodedKey}/${windowSec}`);
  }

  // Read remaining TTL to provide retry hint.
  const ttlJson = (await kvRequest(`/ttl/${encodedKey}`)) as {
    result?: number | string;
  };
  const ttlSec = Math.max(0, Number(ttlJson.result ?? windowSec));
  const resetMs = ttlSec * 1000;

  const allowed = count <= config.max;
  const remaining = Math.max(0, config.max - count);

  return { allowed, remaining, resetMs };
}

/**
 * Check rate limit for a given key (IP, address, etc).
 * Returns whether the request is allowed and remaining quota.
 */
export function checkRateLimitSync(
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

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!hasKvBackend()) {
    return checkRateLimitSync(key, config);
  }

  try {
    return await checkRateLimitKv(key, config);
  } catch {
    // If KV is unavailable, degrade gracefully to local limiter.
    return checkRateLimitSync(key, config);
  }
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
export async function rateLimitResponse(
  request: Request,
  prefix: string,
  config: RateLimitConfig = RATE_LIMITS.write
): Promise<Response | null> {
  const key = getRateLimitKey(request, prefix);
  const result = await checkRateLimit(key, config);

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
