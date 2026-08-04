/**
 * A small in-memory sliding-window limiter, used to stop the login being
 * brute-forced.
 *
 * WHAT THIS IS NOT
 * ----------------
 * State lives in a module-level Map, so it is per server instance:
 *   - it resets on cold start / redeploy;
 *   - on serverless it is NOT shared between concurrent instances, so an
 *     attacker who happens to spread requests across N instances effectively
 *     gets N × the budget;
 *   - it cannot be inspected or cleared from outside the process.
 *
 * That is a deliberate trade for this app. There is exactly one login, guarded
 * by a bcrypt hash with a work factor; the limiter's job is to make online
 * guessing pointlessly slow and to keep a script from hammering the endpoint —
 * not to be an authorization boundary. If the café ever needs a real one, this
 * module is the single place to swap in a shared store (Upstash/Redis) without
 * touching the call sites.
 */

type Window = {
  /** Timestamps (ms) of the attempts still inside the window. */
  hits: number[];
};

const buckets = new Map<string, Window>();

/** Stop the Map growing without bound if it is ever hit with many keys. */
const MAX_TRACKED_KEYS = 5_000;

export type RateLimitOptions = {
  /** Attempts allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Attempts left after this call (0 when blocked). */
  remaining: number;
  /** How long until the next attempt would be allowed, in milliseconds. */
  retryAfterMs: number;
};

/** Drop expired timestamps, and the whole bucket once it is empty. */
function prune(now: number, windowMs: number): void {
  for (const [key, window] of buckets) {
    window.hits = window.hits.filter((at) => now - at < windowMs);
    if (window.hits.length === 0) buckets.delete(key);
  }
}

function evaluate(key: string, now: number, { limit, windowMs }: RateLimitOptions) {
  const window = buckets.get(key);
  const hits = window ? window.hits.filter((at) => now - at < windowMs) : [];
  const oldest = hits[0];
  return {
    hits,
    blocked: hits.length >= limit,
    retryAfterMs: oldest === undefined ? 0 : Math.max(0, windowMs - (now - oldest)),
  };
}

/**
 * Look at the budget WITHOUT spending any of it.
 *
 * The login server action uses this to show "too many attempts" before it even
 * calls signIn; the authoritative spend happens in consume() inside authorize(),
 * so posting straight at the Auth.js callback endpoint is limited just the same.
 */
export function peek(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const { hits, blocked, retryAfterMs } = evaluate(key, now, options);
  return {
    allowed: !blocked,
    remaining: Math.max(0, options.limit - hits.length),
    retryAfterMs,
  };
}

/** Record an attempt and report whether it was allowed. */
export function consume(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) prune(now, options.windowMs);

  const { hits, blocked, retryAfterMs } = evaluate(key, now, options);

  if (blocked) {
    // Do not extend the window on a blocked attempt — hammering the endpoint
    // must not push the legitimate owner's unlock time further away.
    buckets.set(key, { hits });
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  hits.push(now);
  buckets.set(key, { hits });
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - hits.length),
    retryAfterMs: 0,
  };
}

/** Give the budget back — called after a successful login. */
export function reset(key: string): void {
  buckets.delete(key);
}

/**
 * Best-effort client address for a rate-limit key.
 *
 * `x-forwarded-for` is set by Vercel's edge and by any sane reverse proxy; the
 * left-most entry is the original client. It is spoofable when the app is
 * exposed without a trusted proxy in front, which is another reason this
 * limiter is a speed bump rather than a security boundary.
 */
export function clientKeyFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
