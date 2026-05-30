import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, rate limits
// are stored in Redis — consistent across all server instances and edge regions.
// Without them the implementation falls back to an in-process Map, which is
// fine for single-instance deployments but bypassed under horizontal scaling.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

if (process.env.NODE_ENV === "production" && !redis) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production for distributed rate limiting"
  );
}

// Cache Ratelimit instances by "max|windowMs" — created once per unique limit
// configuration, reused across requests within the same process lifetime.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(windowMs: number, max: number): Ratelimit {
  const cacheKey = `${max}|${windowMs}`;
  if (!limiterCache.has(cacheKey)) {
    limiterCache.set(
      cacheKey,
      new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(max, `${Math.ceil(windowMs / 1000)} s`),
        prefix: "rl",
      })
    );
  }
  return limiterCache.get(cacheKey)!;
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const store = new Map<string, number[]>();
let lastCleanup = Date.now();

function rateLimitMemory(
  key: string,
  windowMs: number,
  max: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  if (now - lastCleanup > 5 * 60_000) {
    lastCleanup = now;
    for (const [k, ts] of store.entries()) {
      if (ts.every((t) => now - t > windowMs)) store.delete(k);
    }
  }

  const windowStart = now - windowMs;
  const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= max) {
    const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000);
    store.set(key, timestamps);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { ok: true, retryAfter: 0 };
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function rateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<{ ok: boolean; retryAfter: number }> {
  if (redis) {
    const { success, reset } = await getLimiter(windowMs, max).limit(key);
    const retryAfter = success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return { ok: success, retryAfter };
  }
  return rateLimitMemory(key, windowMs, max);
}

export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
