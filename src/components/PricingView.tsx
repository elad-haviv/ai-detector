'use client';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshAccount, signInUrl, useAccount } from '@/lib/account';
import { he } from '@/lib/i18n/he';
import { openCheckout } from '@/lib/paddle';
import { IconCheck } from './icons';
import { Button, ButtonLink, Card, SegmentedControl, buttonClass, useToast } from './ui';

export interface PricingCheckout {
  env: 'sandbox' | 'production';
  clientToken: string;
  priceMonthly: string;
  priceYearly?: string;
  priceLabel?: string;
  priceLabelYearly?: string;
  locale: string;
}

type Period = 'monthly' | 'yearly';

export function PricingView({ checkout, limit }: { checkout: PricingCheckout | null; limit: number }) {
  const account = useAccount();
  const params = useSearchParams();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>(params.get('period') === 'yearly' ? 'yearly' : 'monthly');
  const [opening, setOpening] = useState(false);
  const autoOpened = useRef(false);
  const yearly = Boolean(checkout?.priceYearly);
  const priceLabel = period === 'yearly' && yearly ? checkout?.priceLabelYearly || checkout?.priceLabel : checkout?.priceLabel;

  const startCheckout = useCallback(async () => {
    if (!checkout || !account.email || opening) return;
    setOpening(true);
    try {
      await openCheckout(checkout, {
        priceId: period === 'yearly' && checkout.priceYearly ? checkout.priceYearly : checkout.priceMonthly,
        email: account.email,
        successUrl: `${window.location.origin}/account?checkout=success`,
        onCompleted: () => void refreshAccount(),
      });
    } catch {
      toast(he.pricing.checkoutError, { tone: 'danger' });
    } finally {
      setOpening(false);
    }
  }, [checkout, account.email, opening, period, toast]);

  // Back from "sign in and continue to payment": open the checkout once, as the button promised.
  useEffect(() => {
    if (autoOpened.current || params.get('checkout') !== '1' || !account.loaded) return;
    autoOpened.current = true;
    if (account.signedIn && account.plan !== 'pro') void startCheckout();
  }, [params, account.loaded, account.signedIn, account.plan, startCheckout]);

  let cta: React.ReactNode;
  if (!checkout) {
    cta = (
      <div className="space-y-1">
        <button type="button" disabled aria-describedby="pro-soon" className={buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' })}>
          {he.pricing.ctaSoon}
        </button>
        <p id="pro-soon" className="text-caption text-muted">
          {he.pricing.soonNote}
        </p>
      </div>
    );
  } else if (!account.loaded) {
    cta = <div className="h-12" aria-hidden />;
  } else if (account.plan === 'pro') {
    cta = (
      <ButtonLink href="/account" variant="primary" size="lg" className="w-full">
        {he.pricing.ctaManage}
      </ButtonLink>
    );
  } else if (!account.signedIn) {
    cta = (
      <div className="space-y-1">
        <a href={signInUrl(`/pricing?checkout=1&period=${period}`)} aria-describedby="pro-cookie" className={buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' })}>
          {he.pricing.ctaSignIn}
        </a>
        <p id="pro-cookie" className="text-caption text-muted">
          {he.account.googleCookieNote}
        </p>
      </div>
    );
  } else {
    cta = (
      <Button variant="primary" size="lg" className="w-full" onClick={startCheckout} aria-disabled={opening || undefined}>
        {opening ? he.pricing.opening : he.pricing.ctaUpgrade}
      </Button>
    );
  }

  return (
    <div className="mx-auto max-w-[960px] px-4 py-6 md:py-10">
      <h1 className="text-title font-bold">{he.pricing.title}</h1>
      <p className="mt-1 text-muted">{he.pricing.intro}</p>

      {yearly && (
        <div className="mt-4 max-w-xs">
          <SegmentedControl<Period>
            legend={he.pricing.period}
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'monthly', label: he.pricing.monthly },
              { value: 'yearly', label: he.pricing.yearly },
            ]}
          />
        </div>
      )}

      <ul className="mt-5 grid gap-4 md:grid-cols-2">
        <li>
          <Card padding="lg" className="flex h-full flex-col" aria-labelledby="plan-free">
            <h2 id="plan-free" className="text-h2 font-bold">
              {he.pricing.freeName}
            </h2>
            <p className="mt-2">
              <span className="text-title font-bold">{he.pricing.freePrice}</span>
            </p>
            <p className="text-caption text-muted">{he.pricing.freePriceNote}</p>
            <Features items={he.pricing.freeFeatures} />
            <ButtonLink href="/settings#access" size="lg" className="mt-auto w-full">
              {he.pricing.freeCta}
            </ButtonLink>
          </Card>
        </li>
        <li>
          <Card padding="lg" className="flex h-full flex-col border-accent ring-1 ring-accent" aria-labelledby="plan-pro">
            <div className="flex items-center justify-between gap-2">
              <h2 id="plan-pro" className="text-h2 font-bold" lang="en">
                {he.pricing.proName}
              </h2>
              <span className="rounded-full bg-accent-soft px-2 text-caption font-semibold text-accent">{he.pricing.proRecommended}</span>
            </div>
            <p className="mt-2">
              <span className="text-title font-bold">{priceLabel || he.pricing.proPriceFallback}</span>
            </p>
            <p className="text-caption text-muted">{he.pricing.paddleNote}</p>
            <Features items={he.pricing.proFeatures.map((f) => f.replace('{limit}', String(limit)))} />
            <div className="mt-auto">{cta}</div>
          </Card>
        </li>
      </ul>

      <section aria-labelledby="faq-title" className="mt-10">
        <h2 id="faq-title" className="text-h2 font-bold">
          {he.pricing.faqTitle}
        </h2>
        <div className="mt-3 space-y-2">
          {he.pricing.faq.map((f) => (
            <details key={f.q} className="rounded-lg border border-border bg-surface px-4">
              <summary className="flex min-h-12 cursor-pointer items-center font-semibold">{f.q}</summary>
              <p className="pb-4 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Features({ items }: { items: readonly string[] }) {
  return (
    <ul className="my-5 space-y-2 text-sm">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <IconCheck width={18} height={18} className="mt-0.5 shrink-0 text-success" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
