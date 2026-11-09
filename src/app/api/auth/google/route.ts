import { NextResponse } from 'next/server';
import { LANG_COOKIE, resolveLocale } from '@/lib/i18n/config';
import { authorizeUrl, googleConfig, redirectUri } from '@/lib/server/google';
import { appOrigin, cookieHeader, readCookie, OAUTH_COOKIE, OAUTH_MAX_AGE, pkceChallenge, randomToken, safeReturnTo, secureCookies, sessionSecret, signToken } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Start "Sign in with Google": create `state` and a PKCE verifier, keep them in a short-lived signed
 * HttpOnly cookie (no server storage), and redirect to Google.
 */
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const cfg = googleConfig();
  const secret = sessionSecret();
  if (!cfg || !secret) return NextResponse.redirect(`${origin}/account?error=not_configured`, 303);
  const returnTo = safeReturnTo(new URL(req.url).searchParams.get('returnTo'));
  const state = randomToken(24);
  const verifier = randomToken(48);
  const payload = { state, verifier, returnTo, exp: Math.floor(Date.now() / 1000) + OAUTH_MAX_AGE };
  // Google's consent screen in the UI language (same rule as the pages: cookie, then Accept-Language).
  const hl = resolveLocale(readCookie(req, LANG_COOKIE), req.headers.get('accept-language'));
  const res = NextResponse.redirect(authorizeUrl({ clientId: cfg.clientId, redirectUri: redirectUri(origin), state, challenge: pkceChallenge(verifier), hl }), 303);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.append('Set-Cookie', cookieHeader(OAUTH_COOKIE, signToken(payload, secret), { maxAge: OAUTH_MAX_AGE, secure: secureCookies(origin), path: '/api/auth' }));
  return res;
}
