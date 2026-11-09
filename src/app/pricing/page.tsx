import type { Metadata } from 'next';
import { StubPage } from '@/components/StubPage';
import { he } from '@/lib/i18n/he';

export const metadata: Metadata = { title: `${he.stub.pricingTitle} · ${he.appName}` };

/** Placeholder until M3 adds the Free (BYOK) vs Pro comparison and checkout. */
export default function PricingPage() {
  return <StubPage title={he.stub.pricingTitle} intro={he.stub.pricingIntro} />;
}
