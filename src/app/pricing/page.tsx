import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PricingView } from '@/components/PricingView';
import { getLocale, pageTitle } from '@/lib/i18n/server';
import { configured } from '@/lib/server/account';
import { checkoutConfig } from '@/lib/server/billing';
import { proLimitPerHour } from '@/lib/server/rateLimit';

export async function generateMetadata(): Promise<Metadata> {
  return pageTitle((t) => t.pricing.title);
}
// Paddle settings are read from the environment at request time (no rebuild needed to change them).
export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const ready = configured().billing;
  const locale = await getLocale();
  return (
    <Suspense>
      <PricingView checkout={ready ? checkoutConfig(locale) : null} limit={proLimitPerHour()} />
    </Suspense>
  );
}
