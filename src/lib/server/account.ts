import 'server-only';
import { NextResponse } from 'next/server';
import type { AccountInfo } from '../types';
import { checkoutConfig } from './billing';
import { currentSub, isPro } from './entitlement';
import { googleConfig } from './google';
import { managedTarget } from './llm';
import { appOrigin, clearCookie, readCookie, readSession, sessionCookie, sessionSecret, SESSION_COOKIE, type SessionPayload, type SessionSub } from './session';

export function configured(): AccountInfo['configured'] {
  const google = Boolean(googleConfig() && sessionSecret());
  return { google, billing: google && Boolean(checkoutConfig()) };
}

export function accountInfo(session: SessionPayload | null, sub: SessionSub | undefined): AccountInfo {
  if (!session) return { signedIn: false, plan: 'free', configured: configured() };
  const pro = isPro(sub);
  return {
    signedIn: true,
    email: session.email,
    name: session.name,
    plan: pro ? 'pro' : 'free',
    subscription:
      sub && sub.status !== 'none'
        ? { status: sub.status, renewsAt: sub.renewsAt, cancelsAt: sub.cancelsAt, graceUntil: sub.graceUntil }
        : undefined,
    managed: pro ? managedTarget() : undefined,
    configured: configured(),
  };
}

/**
 * Account state for the request, refreshing the cached Paddle state when stale (or always with
 * `force`), and re-signing the session cookie when it changed. A cookie that fails verification is
 * cleared.
 */
export async function accountResponse(req: Request, opts: { force?: boolean } = {}): Promise<NextResponse> {
  const headers = new Headers({ 'Cache-Control': 'no-store, max-age=0' });
  const origin = appOrigin(req);
  const session = readSession(req);
  if (!session) {
    if (readCookie(req, SESSION_COOKIE)) headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, origin));
    return NextResponse.json(accountInfo(null, undefined), { headers });
  }
  const { sub, changed } = await currentSub(session, opts);
  const secret = sessionSecret();
  if (changed && sub && secret) {
    // Keep the original expiry: refreshing the plan does not extend the sign-in.
    headers.append('Set-Cookie', sessionCookie({ ...session, sub }, secret, origin).replace(/Max-Age=\d+/, `Max-Age=${Math.max(0, session.exp - Math.floor(Date.now() / 1000))}`));
  }
  return NextResponse.json(accountInfo(session, sub), { headers });
}
