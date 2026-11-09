import 'server-only';

export type Entitlement = { plan: 'pro'; email: string } | { plan: 'free' };

/**
 * Who is allowed to use the operator's server-side (env) API keys.
 *
 * This is the single gate for "managed mode": routes call it before falling back to any env key,
 * and only `{ plan: 'pro' }` unlocks them. Everyone else must bring their own key (BYOK) or gets
 * a 401 `missing_key` (the client then runs local rules only).
 *
 * TODO(M3): read and verify the signed, HttpOnly session cookie (HMAC-SHA256 with SESSION_SECRET),
 * check the cached Paddle subscription status in it, and return `{ plan: 'pro', email }` for an
 * active subscriber. Until then nobody is entitled, so env keys are never used.
 */
export async function getEntitlement(req: Request): Promise<Entitlement> {
  void req;
  return { plan: 'free' };
}
