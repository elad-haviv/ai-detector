import { accountResponse } from '@/lib/server/account';
import { json } from '@/lib/server/http';
import { readSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Re-check the subscription in Paddle now (after checkout, or "refresh status") and re-sign the cookie. */
export async function POST(req: Request) {
  if (!readSession(req)) return json({ error: 'not_signed_in' }, { status: 401 });
  return accountResponse(req, { force: true });
}
