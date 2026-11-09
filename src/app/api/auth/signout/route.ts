import { NextResponse } from 'next/server';
import { appOrigin, clearCookie, SESSION_COOKIE } from '@/lib/server/session';

export const runtime = 'nodejs';

/** Sign out: the session lives only in the cookie, so clearing it is all there is to do. */
export async function POST(req: Request) {
  const origin = appOrigin(req);
  // Same-origin check (SameSite=Lax already blocks cross-site POSTs carrying the cookie).
  const from = req.headers.get('origin');
  if (from && from !== origin && from !== new URL(req.url).origin) return NextResponse.json({ error: 'bad_origin' }, { status: 403 });
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, origin));
  return res;
}
