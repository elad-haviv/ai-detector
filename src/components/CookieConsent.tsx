'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getConsent, OPEN_COOKIE_SETTINGS_EVENT, setConsent, type Consent, type ConsentChoice } from '@/lib/consent';
import { he } from '@/lib/i18n/he';
import { Button, Dialog, useToast } from './ui';

export { getConsent } from '@/lib/consent';

/**
 * First-visit cookie notice and the "cookie settings" dialog.
 *
 * - Banner: a non-modal `role="region"` at the bottom (above the mobile tab bar). It does not trap
 *   focus or cover content: the page gets bottom padding equal to its height while it shows.
 * - The footer's "הגדרות עוגיות" dispatches OPEN_COOKIE_SETTINGS_EVENT; we preventDefault() it
 *   (telling the footer it was handled) and open a Dialog with the categories.
 */
export function CookieConsent() {
  const [consent, setState] = useState<Consent | null>(null);
  const [banner, setBanner] = useState(false);
  const [dialog, setDialog] = useState(false);
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = getConsent();
    setState(c);
    setBanner(!c);
  }, []);

  useEffect(() => {
    const open = (e: Event) => {
      e.preventDefault();
      setState(getConsent());
      setDialog(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  // Reserve room at the bottom of the page so the banner never hides the last content.
  useEffect(() => {
    const el = ref.current;
    if (!banner || !el) return;
    const apply = () => document.body.style.setProperty('padding-bottom', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.removeProperty('padding-bottom');
    };
  }, [banner]);

  const choose = (choice: ConsentChoice) => {
    setState(setConsent(choice));
    setBanner(false);
    setDialog(false);
    toast(he.consent.saved, { tone: 'success' });
  };

  return (
    <>
      {banner && (
        <div
          ref={ref}
          role="region"
          aria-label={he.consent.regionLabel}
          tabIndex={-1}
          data-consent-banner
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border-strong bg-surface shadow-lg md:bottom-0"
        >
          <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6">
            <div className="min-w-0 flex-1 text-sm">
              <h2 id="consent-title" className="font-bold">
                {he.consent.title}
              </h2>
              <p className="mt-0.5 text-muted">{he.consent.body}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => choose('all')}>
                {he.consent.accept}
              </Button>
              <Button onClick={() => choose('essential')}>{he.consent.essentialOnly}</Button>
              <Link href="/privacy#cookies" className="inline-flex min-h-11 items-center px-2 font-semibold text-accent underline underline-offset-4 hover:no-underline">
                {he.consent.details}
              </Link>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title={he.consent.dialogTitle}
        description={he.consent.dialogIntro}
        footer={
          <>
            <Button onClick={() => choose('essential')}>{he.consent.essentialOnly}</Button>
            <Button variant="primary" onClick={() => choose('all')}>
              {he.consent.accept}
            </Button>
          </>
        }
      >
        <ul className="space-y-3">
          <Category title={he.consent.essentialTitle} body={he.consent.essentialBody} state={he.consent.alwaysOn} checked />
          <Category title={he.consent.analyticsTitle} body={he.consent.analyticsBody} state={he.consent.notInUse} checked={false} />
        </ul>
        {consent && (
          <p className="mt-3 text-caption text-muted">
            {he.consent.current
              .replace('{choice}', consent.choice === 'all' ? he.consent.currentAll : he.consent.currentEssential)
              .replace('{date}', consent.date)}
          </p>
        )}
        <p className="mt-2 text-sm">
          <Link href="/privacy#cookies" onClick={() => setDialog(false)} className="font-semibold text-accent underline underline-offset-4 hover:no-underline">
            {he.consent.details}
          </Link>
        </p>
      </Dialog>
    </>
  );
}

function Category({ title, body, state, checked }: { title: string; body: string; state: string; checked: boolean }) {
  const id = `cc-${title.length}-${checked ? 1 : 0}`;
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-bold">
          {title}
        </label>
        <span className="flex items-center gap-2 text-caption text-muted">
          <span id={`${id}-state`}>{state}</span>
          <input id={id} type="checkbox" role="switch" checked={checked} disabled readOnly aria-describedby={`${id}-state ${id}-body`} className="size-5 accent-[var(--accent)]" />
        </span>
      </div>
      <p id={`${id}-body`} className="mt-1 text-sm text-muted">
        {body}
      </p>
    </li>
  );
}
