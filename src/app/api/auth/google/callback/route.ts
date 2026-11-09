import { NextResponse } from 'next/server';
import { toSessionSub } from '@/lib/server/entitlement';
import { getBilling } from '@/lib/server/billing';
import { exchangeCode, googleConfig, redirectUri } from '@/lib/server/google';
import {
  appOrigin,
  clearCookie,
  constantTimeEqual,
  newSession,
  OAUTH_COOKIE,
  readCookie,
  safeReturnTo,
  sessionCookie,
  sessionSecret,
  verifyToken,
  type SessionSub,
} from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Google redirects back here: check state, exchange the code (with PKCE), set the session cookie. */
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const url = new URL(req.url);
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/account?error=${code}`, 303);
    res.headers.append('Set-Cookie', clearCookie(OAUTH_COOKIE, origin, '/api/auth'));
    return res;
  };
  const cfg = googleConfig();
  const secret = sessionSecret();
  if (!cfg || !secret) return fail('not_configured');
  if (url.searchParams.get('error')) return fail('cancelled');

  const flow = verifyToken<{ state: string; verifier: string; returnTo: string; exp: number }>(readCookie(req, OAUTH_COOKIE), secret);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (!flow || !code || !state || !constantTimeEqual(state, flow.state)) return fail('state');

  let identity;
  try {
    identity = await exchangeCode({ code, verifier: flow.verifier, redirectUri: redirectUri(origin), clientId: cfg.clientId, clientSecret: cfg.clientSecret });
  } catch {
    identity = null;
  }
  if (!identity) return fail('google');

  // Look up the subscription once now so the plan is right from the first page view.
  let sub: SessionSub | undefined;
  const billing = getBilling();
  if (billing) {
    try {
      sub = toSessionSub(await billing.findActiveSubscription(identity.email));
    } catch {
      sub = undefined;
    }
  }

  const res = NextResponse.redirect(`${origin}${safeReturnTo(flow.returnTo)}`, 303);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.append('Set-Cookie', clearCookie(OAUTH_COOKIE, origin, '/api/auth'));
  res.headers.append('Set-Cookie', sessionCookie(newSession(identity.email, identity.name, sub), secret, origin));
  return res;
}
