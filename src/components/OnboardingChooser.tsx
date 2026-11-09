'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { he } from '@/lib/i18n/he';
import { IconInfo, IconKey, IconPen, IconShield } from './icons';

const FLAG = 'kulmus:onboarded:v1';

function readFlag(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Shown above the input when analysis would run on local rules only (no key, not Pro).
 * First visit: a 3-way "how do you want to start?" chooser. After "try local rules" it collapses into
 * the one-line local-only notice, so there is never more than one banner.
 */
export function OnboardingChooser() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => setDismissed(readFlag()), []);
  if (dismissed === null) return null;

  if (dismissed) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-border border-s-4 border-s-warning bg-surface p-3 text-sm">
        <IconInfo className="mt-0.5 shrink-0 text-warning" />
        <p>
          {he.input.localOnlyNotice}{' '}
          <Link href="/settings#access" className="font-semibold text-accent underline underline-offset-4">
            {he.input.localOnlyLink}
          </Link>
        </p>
      </div>
    );
  }

  const option = 'flex h-full min-h-11 w-full items-start gap-3 rounded-lg border border-border-strong bg-surface p-3 text-start transition-colors hover:bg-surface-2';
  return (
    <section aria-labelledby="onboarding-title" className="mt-4 rounded-xl border border-border bg-surface-2 p-4" data-onboarding>
      <h2 id="onboarding-title" className="text-h2 font-bold">
        {he.onboarding.title}
      </h2>
      <p className="mt-0.5 text-sm text-muted">{he.onboarding.intro}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        <li>
          <Link href="/pricing" className={option}>
            <IconShield className="mt-0.5 shrink-0 text-accent" />
            <span>
              <span className="block font-bold">{he.onboarding.proTitle}</span>
              <span className="block text-caption text-muted">{he.onboarding.proBody}</span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/settings#access" className={option}>
            <IconKey className="mt-0.5 shrink-0 text-accent" />
            <span>
              <span className="block font-bold">{he.onboarding.keyTitle}</span>
              <span className="block text-caption text-muted">{he.onboarding.keyBody}</span>
            </span>
          </Link>
        </li>
        <li>
          <button
            type="button"
            className={option}
            onClick={() => {
              try {
                localStorage.setItem(FLAG, '1');
              } catch {}
              setDismissed(true);
            }}
          >
            <IconPen className="mt-0.5 shrink-0 text-accent" />
            <span>
              <span className="block font-bold">{he.onboarding.localTitle}</span>
              <span className="block text-caption text-muted">{he.onboarding.localBody}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  );
}
