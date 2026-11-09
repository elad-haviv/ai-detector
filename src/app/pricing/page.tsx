import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PricingView } from '@/components/PricingView';
import { he } from '@/lib/i18n/he';
import { configured } from '@/lib/server/account';
import { checkoutConfig } from '@/lib/server/billing';
import { proLimitPerHour } from '@/lib/server/rateLimit';

export const metadata: Metadata = { title: `${he.pricing.title} · ${he.appName}` };
// Paddle settings are read from the environment at request time (no rebuild needed to change them).
export const dynamic = 'force-dynamic';

export default function PricingPage() {
  const ready = configured().billing;
  return (
    <Suspense>
      <PricingView checkout={ready ? checkoutConfig() : null} limit={proLimitPerHour()} />
    </Suspense>
  );
}
