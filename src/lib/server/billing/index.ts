import 'server-only';
import type { Locale } from '@/lib/i18n/config';
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

/**
 * Checkout config for the page's UI locale: the price labels come in a Hebrew and an English
 * variant (`…_EN`, falling back to the Hebrew one), and Paddle's checkout language follows the UI
 * unless NEXT_PUBLIC_PADDLE_LOCALE pins it.
 */
export function checkoutConfig(locale: Locale): CheckoutConfig | null {
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();
  const priceMonthly = process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY?.trim();
  if (!clientToken || !priceMonthly || !getBilling()) return null;
  return {
    env: paddleEnv(),
    clientToken,
    priceMonthly,
    priceYearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY?.trim() || undefined,
    priceLabel: label('NEXT_PUBLIC_PRO_PRICE_LABEL', locale),
    priceLabelYearly: label('NEXT_PUBLIC_PRO_PRICE_LABEL_YEARLY', locale),
    locale: process.env.NEXT_PUBLIC_PADDLE_LOCALE?.trim() || locale,
  };
}

function label(name: string, locale: Locale): string | undefined {
  const he = process.env[name]?.trim() || undefined;
  return locale === 'en' ? process.env[`${name}_EN`]?.trim() || he : he;
}
