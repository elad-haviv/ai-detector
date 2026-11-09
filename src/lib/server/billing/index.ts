import 'server-only';
import { createPaddleBilling, type PaddleEnv } from './paddle';
import type { BillingProvider } from './types';

export type { BillingProvider, SubscriptionInfo } from './types';
export { PaddleApiError as BillingError } from './paddle';

/** Public (browser) checkout config, read at request time so a Docker image needs no rebuild. */
export interface CheckoutConfig {
  env: PaddleEnv;
  clientToken: string;
  priceMonthly: string;
  priceYearly?: string;
  priceLabel?: string;
  priceLabelYearly?: string;
  locale: string;
}

export function paddleEnv(): PaddleEnv {
  return process.env.PADDLE_ENV?.trim() === 'production' ? 'production' : 'sandbox';
}

let cached: { key: string; provider: BillingProvider } | null = null;

/** The configured billing provider, or null when PADDLE_API_KEY is missing. */
export function getBilling(): BillingProvider | null {
  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) return null;
  const key = `${apiKey}|${paddleEnv()}`;
  if (cached?.key !== key) {
    const grace = Number(process.env.PAST_DUE_GRACE_DAYS);
    cached = { key, provider: createPaddleBilling({ apiKey, env: paddleEnv(), pastDueGraceDays: Number.isFinite(grace) && grace >= 0 ? grace : undefined }) };
  }
  return cached.provider;
}

export function checkoutConfig(): CheckoutConfig | null {
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();
  const priceMonthly = process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY?.trim();
  if (!clientToken || !priceMonthly || !getBilling()) return null;
  return {
    env: paddleEnv(),
    clientToken,
    priceMonthly,
    priceYearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY?.trim() || undefined,
    priceLabel: process.env.NEXT_PUBLIC_PRO_PRICE_LABEL?.trim() || undefined,
    priceLabelYearly: process.env.NEXT_PUBLIC_PRO_PRICE_LABEL_YEARLY?.trim() || undefined,
    locale: process.env.NEXT_PUBLIC_PADDLE_LOCALE?.trim() || 'he',
  };
}
