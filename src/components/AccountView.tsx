'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { refreshAccount, signOut, useAccount } from '@/lib/account';
import { he } from '@/lib/i18n/he';
import { GoogleSignIn } from './GoogleSignIn';
import { IconShield } from './icons';
import { Button, ButtonLink, Card, useToast } from './ui';

export function formatDate(iso?: string | number): string {
  if (iso === undefined) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function AccountView() {
  const account = useAccount();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<'refresh' | 'portal' | 'signout' | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState('');
  const polled = useRef(false);
  const error = params.get('error');

  // Back from Paddle checkout: the subscription can take a few seconds to appear, so poll briefly.
  useEffect(() => {
    if (params.get('checkout') !== 'success' || polled.current || !account.loaded || !account.signedIn) return;
    polled.current = true;
    let cancelled = false;
    (async () => {
      setCheckoutMsg(he.account.checkoutPending);
      for (let i = 0; i < 6 && !cancelled; i++) {
        const s = await refreshAccount();
        if (s.plan === 'pro') {
          setCheckoutMsg(he.account.checkoutDone);
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) setCheckoutMsg(he.account.checkoutSlow);
    })();
    return () => {
      cancelled = true;
    };
  }, [params, account.loaded, account.signedIn]);

  async function openPortal() {
    setBusy('portal');
    try {
      const res = await fetch('/api/account/portal', { method: 'POST', cache: 'no-store' });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) throw new Error();
      window.location.assign(data.url);
    } catch {
      toast(he.account.portalError, { tone: 'danger' });
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 md:py-10">
      <h1 className="text-title font-bold">{he.account.title}</h1>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-border border-s-4 border-s-danger bg-surface p-3 text-sm font-semibold text-danger">
          {he.account.errors[error] || he.errors.unknown}
        </p>
      )}

      {!account.loaded ? (
        <Card className="mt-4 h-48 animate-pulse" aria-hidden />
      ) : !account.signedIn ? (
        <Card className="mt-4 space-y-4" padding="lg">
          <h2 className="text-h2 font-bold">{he.account.signedOutTitle}</h2>
          <p>{he.account.whySignIn}</p>
          <p className="flex items-start gap-2 text-sm text-muted">
            <IconShield className="mt-0.5 shrink-0 text-success" />
            {he.account.whatWeKeep}
          </p>
          <GoogleSignIn returnTo="/account" />
        </Card>
      ) : (
        <Card className="mt-4 space-y-5" padding="lg">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-lg font-bold text-accent-fg">
              {Array.from((account.name || account.email || '?').trim())[0]?.toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-caption text-muted">{he.account.signedInAs}</p>
              {account.name && <p className="truncate font-bold">{account.name}</p>}
              <p dir="ltr" className="truncate text-start text-sm" data-testid="account-email">
                {account.email}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
            <dt className="font-semibold text-muted">{he.account.plan}</dt>
            <dd className={account.plan === 'pro' ? 'font-bold text-success' : ''} lang={account.plan === 'pro' ? 'en' : undefined} data-testid="account-plan">
              {account.plan === 'pro' ? he.account.planPro : he.account.planFree}
            </dd>
            {account.subscription && (
              <>
                <dt className="font-semibold text-muted">{he.account.status}</dt>
                <dd>{he.account.statuses[account.subscription.status] || account.subscription.status}</dd>
              </>
            )}
            {account.subscription?.renewsAt && (
              <>
                <dt className="font-semibold text-muted">{he.account.renewsOn}</dt>
                <dd>{formatDate(account.subscription.renewsAt)}</dd>
              </>
            )}
            {account.subscription?.cancelsAt && (
              <>
                <dt className="font-semibold text-muted">{he.account.cancelsOn}</dt>
                <dd>{formatDate(account.subscription.cancelsAt)}</dd>
              </>
            )}
            {account.subscription?.status === 'past_due' && account.subscription.graceUntil && (
              <>
                <dt className="font-semibold text-muted">{he.account.graceUntil}</dt>
                <dd>{formatDate(account.subscription.graceUntil)}</dd>
              </>
            )}
          </dl>
          {account.subscription?.status === 'past_due' && <p className="text-sm text-warning">{he.account.pastDueNote}</p>}

          <p role="status" className="text-sm font-semibold empty:hidden">
            {checkoutMsg}
          </p>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {account.subscription ? (
              <Button variant="primary" onClick={openPortal} aria-disabled={busy === 'portal' || undefined} aria-describedby="portal-hint">
                {he.account.manageBilling}
              </Button>
            ) : (
              account.configured.billing && (
                <ButtonLink href="/pricing" variant="primary">
                  {he.account.upgrade}
                </ButtonLink>
              )
            )}
            <Button
              aria-disabled={busy === 'refresh' || undefined}
              onClick={async () => {
                if (busy) return;
                setBusy('refresh');
                await refreshAccount();
                setBusy(null);
                toast(he.account.refreshed, { tone: 'success' });
              }}
            >
              {busy === 'refresh' ? he.account.refreshing : he.account.refresh}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                setBusy('signout');
                await signOut();
                setBusy(null);
                toast(he.account.signedOut);
                router.replace('/account');
              }}
            >
              {he.account.signOut}
            </Button>
          </div>
          {account.subscription && (
            <p id="portal-hint" className="-mt-3 text-caption text-muted">
              {he.account.manageBillingHint}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
