/**
 * Fair-use limit for subscribers (managed mode only; BYOK requests are never limited by us).
 *
 * Best effort: an in-memory sliding window per email, per server instance. It resets on restart and
 * is not shared between instances, which is acceptable for fair use. Nothing is persisted.
 * Configure with PRO_RATE_LIMIT_PER_HOUR (default 100 model calls: analyze chunks, document
 * assessments and paragraph rewrites each count as one).
 */
import 'server-only';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_KEYS = 10000;
const hits = new Map<string, number[]>();

export function proLimitPerHour(): number {
  const n = Number(process.env.PRO_RATE_LIMIT_PER_HOUR);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}

/** Record one call; returns whether it is allowed and, if not, seconds until a slot frees up. */
export function takeToken(key: string, limit = proLimitPerHour(), now = Date.now()): { ok: boolean; retryAfter: number; remaining: number } {
  const since = now - WINDOW_MS;
  const list = (hits.get(key) || []).filter((t) => t > since);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((list[0] + WINDOW_MS - now) / 1000)), remaining: 0 };
  }
  list.push(now);
  if (!hits.has(key) && hits.size >= MAX_KEYS) {
    // drop the oldest key (insertion order) to bound memory
    hits.delete(hits.keys().next().value!);
  }
  hits.set(key, list);
  return { ok: true, retryAfter: 0, remaining: limit - list.length };
}

/** Test helper. */
export function resetRateLimit() {
  hits.clear();
}
