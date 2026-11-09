import 'server-only';
import { getBilling, type SubscriptionInfo } from './billing';
import { readSession, type SessionPayload, type SessionSub } from './session';

export type Entitlement = { plan: 'pro'; email: string } | { plan: 'free' };

/**
 * Who is allowed to use the operator's server-side (env) API keys ("managed mode").
 * Routes call it before using any env key; only `{ plan: 'pro' }` unlocks them.
 *
 * Caching approach (stateless, no database):
 * 1. The signed session cookie carries a snapshot of the subscription (`sub`, with `checkedAt`).
 *    If that snapshot is younger than 10 minutes it is trusted as is.
 * 2. Otherwise we look the email up in Paddle, through a per-process in-memory cache with the same
 *    10-minute TTL, so a burst of analysis requests costs at most one Paddle lookup per instance.
 *    Route handlers here cannot set cookies, so the cookie itself is re-signed with the fresh state
 *    by GET /api/me (called by the client on load and on focus) and by POST /api/account/refresh.
 * 3. If Paddle is unreachable we keep the last known cookie state for up to 24 hours, then fail
 *    closed (free).
 */
export const SUB_TTL_MS = 10 * 60 * 1000;
const STALE_OK_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 5000;

const cache = new Map<string, { sub: SessionSub; at: number }>();

/** Does this cached subscription state grant Pro right now? */
export function isPro(sub: SessionSub | undefined, now = Date.now()): boolean {
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'past_due') return typeof sub.graceUntil === 'number' && now < sub.graceUntil;
  return false;
}

export function toSessionSub(info: SubscriptionInfo | null, now = Date.now()): SessionSub {
  if (!info) return { status: 'none', plan: 'free', customerId: '', checkedAt: now };
  const sub: SessionSub = {
    status: info.status,
    plan: 'free',
    customerId: info.customerId,
    checkedAt: now,
    ...(info.renewsAt ? { renewsAt: info.renewsAt } : {}),
    ...(info.cancelsAt ? { cancelsAt: info.cancelsAt } : {}),
    ...(info.graceUntil ? { graceUntil: info.graceUntil } : {}),
  };
  sub.plan = isPro(sub, now) ? 'pro' : 'free';
  return sub;
}

/**
 * Current subscription state for a session: the cookie snapshot when fresh, else the in-memory cache,
 * else a Paddle lookup. `force` skips both caches (used after checkout and by "refresh status").
 * Returns `changed: true` when the caller should re-sign the cookie.
 */
export async function currentSub(session: SessionPayload, opts: { force?: boolean } = {}): Promise<{ sub: SessionSub | undefined; changed: boolean }> {
  const now = Date.now();
  const billing = getBilling();
  if (!billing) return { sub: session.sub, changed: false };
  const email = session.email.toLowerCase();
  if (!opts.force) {
    if (session.sub && now - session.sub.checkedAt < SUB_TTL_MS) return { sub: session.sub, changed: false };
    const hit = cache.get(email);
    if (hit && now - hit.at < SUB_TTL_MS) return { sub: hit.sub, changed: true };
  }
  try {
    const sub = toSessionSub(await billing.findActiveSubscription(email), now);
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
    cache.set(email, { sub, at: now });
    return { sub, changed: true };
  } catch {
    // Paddle unreachable: trust the last known state for a while, then fail closed.
    const last = session.sub;
    if (last && now - last.checkedAt < STALE_OK_MS) return { sub: last, changed: false };
    return { sub: undefined, changed: false };
  }
}

export async function getEntitlement(req: Request): Promise<Entitlement> {
  const session = readSession(req);
  if (!session) return { plan: 'free' };
  const { sub } = await currentSub(session);
  return isPro(sub) ? { plan: 'pro', email: session.email } : { plan: 'free' };
}
