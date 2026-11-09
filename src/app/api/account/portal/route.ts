import { getBilling } from '@/lib/server/billing';
import { currentSub } from '@/lib/server/entitlement';
import { json } from '@/lib/server/http';
import { readSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A fresh, short-lived Paddle customer portal link for the signed-in user (manage, cancel, invoices). */
export async function POST(req: Request) {
  const session = readSession(req);
  if (!session) return json({ error: 'not_signed_in' }, { status: 401 });
  const billing = getBilling();
  if (!billing) return json({ error: 'billing_not_configured' }, { status: 503 });
  try {
    let customerId = session.sub?.customerId;
    let subId: string | undefined;
    if (!customerId) {
      const found = await billing.findActiveSubscription(session.email);
      customerId = found?.customerId;
      subId = found?.id;
    } else {
      await currentSub(session); // keeps the in-memory cache warm; portal works without it
    }
    if (!customerId) return json({ error: 'no_customer' }, { status: 404 });
    const url = await billing.createPortalUrl(customerId, subId ? [subId] : undefined);
    return json({ url });
  } catch {
    return json({ error: 'billing_unavailable' }, { status: 502 });
  }
}
