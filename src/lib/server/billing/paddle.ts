/**
 * Paddle Billing (merchant of record) over its REST API with fetch. No webhooks, no database:
 * the subscription is looked up by the customer's email whenever we need it.
 *
 *   GET  /customers?email=<email>                              → customer ids
 *   GET  /subscriptions?customer_id=<ids>&status=active,trialing,past_due
 *   POST /customers/{customer_id}/portal-sessions              → data.urls.general.overview
 *
 * Only type imports here, so it can be unit-tested with a fake fetch in plain Node.
 */
import 'server-only';
import type { BillingProvider, SubscriptionInfo } from './types';

/** Error from the Paddle API; `status` is the HTTP status our route should answer with. */
export class PaddleApiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export const PADDLE_API = { sandbox: 'https://sandbox-api.paddle.com', production: 'https://api.paddle.com' } as const;
export type PaddleEnv = keyof typeof PADDLE_API;

const RANK: Record<string, number> = { active: 3, trialing: 2, past_due: 1 };
const DAY = 24 * 60 * 60 * 1000;

interface PaddleSubscription {
  id: string;
  status: string;
  customer_id: string;
  next_billed_at?: string | null;
  current_billing_period?: { starts_at?: string; ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
}

export function createPaddleBilling(opts: {
  apiKey: string;
  env: PaddleEnv;
  fetchImpl?: typeof fetch;
  /** Days a past_due subscription keeps Pro access while Paddle retries the payment. */
  pastDueGraceDays?: number;
}): BillingProvider {
  const base = PADDLE_API[opts.env];
  const doFetch = opts.fetchImpl || fetch;
  const graceDays = opts.pastDueGraceDays ?? 14;
  const Err = PaddleApiError;

  async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await doFetch(base + path, {
      method: init?.method || 'GET',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
    if (!res.ok) throw new Err(`paddle ${res.status}`, res.status === 401 || res.status === 403 ? 503 : 502);
    return (await res.json()) as T;
  }

  return {
    name: 'paddle',

    async findActiveSubscription(email) {
      const e = email.trim().toLowerCase();
      if (!e) return null;
      const customers = await call<{ data?: { id: string; email?: string }[] }>(`/customers?email=${encodeURIComponent(e)}`);
      const ids = (customers.data || []).filter((c) => !c.email || c.email.toLowerCase() === e).map((c) => c.id);
      if (!ids.length) return null;
      const subs = await call<{ data?: PaddleSubscription[] }>(
        `/subscriptions?customer_id=${ids.map(encodeURIComponent).join(',')}&status=active,trialing,past_due`,
      );
      const best = (subs.data || [])
        .filter((s) => RANK[s.status])
        .sort((a, b) => RANK[b.status] - RANK[a.status])[0];
      if (!best) return null;
      const cancels = best.scheduled_change?.action === 'cancel' ? best.scheduled_change.effective_at : undefined;
      const info: SubscriptionInfo = {
        id: best.id,
        status: best.status,
        customerId: best.customer_id,
        renewsAt: cancels ? undefined : best.next_billed_at || undefined,
        cancelsAt: cancels || undefined,
      };
      if (best.status === 'past_due') {
        // A failed renewal starts the new period as past_due; Paddle keeps retrying (dunning).
        const start = Date.parse(best.current_billing_period?.starts_at || best.next_billed_at || '');
        info.graceUntil = (Number.isFinite(start) ? start : Date.now()) + graceDays * DAY;
      }
      return info;
    },

    async createPortalUrl(customerId, subscriptionIds) {
      if (!/^ctm_[A-Za-z0-9]+$/.test(customerId)) throw new Err('bad customer id', 400);
      const data = await call<{ data?: { urls?: { general?: { overview?: string } } } }>(`/customers/${customerId}/portal-sessions`, {
        method: 'POST',
        body: subscriptionIds?.length ? { subscription_ids: subscriptionIds } : {},
      });
      const url = data.data?.urls?.general?.overview;
      if (!url || !/^https:\/\//.test(url)) throw new Err('no portal url', 502);
      return url;
    },
  };
}
