'use client';
import Link from 'next/link';
import { useAccount } from '@/lib/account';
import { useLangAttr, useT } from '@/lib/i18n/client';
import { useKeys } from '@/lib/keyStore';
import { llmMode, useSettings } from '@/lib/store';
import { IconKey } from './icons';

/**
 * Header status chip: how analysis will run right now (same rule as the analysis runner, `llmMode`).
 * - "Your key · <provider>" when the chosen provider has a key in the browser (BYOK always wins)
 * - "Pro" for an active subscriber without a key of their own
 * - "Local rules only" otherwise
 */
export function AccessChip() {
  const t = useT();
  const langAttr = useLangAttr();
  const [s] = useSettings();
  const keys = useKeys().keys;
  const account = useAccount();
  const mode = llmMode(s, keys, account);
  const status = mode === 'byok' ? t.shell.accessKey.replace('{provider}', t.settings.providers[s.provider]) : mode === 'managed' ? t.shell.accessPro : t.shell.accessLocal;
  const pro = mode === 'managed';
  return (
    <Link
      href={pro ? '/account' : '/settings#access'}
      aria-label={pro ? t.shell.accountChipPro : t.shell.accessChipLabel.replace('{status}', status)}
      className={`inline-flex min-h-9 min-w-9 max-w-[14rem] items-center justify-center gap-1.5 truncate rounded-full border px-3 max-[400px]:px-2.5 text-caption font-semibold transition-colors hover:bg-surface-2 ${
        mode ? 'border-success text-success' : 'border-border-strong text-muted'
      }`}
    >
      <IconKey width={16} height={16} className="shrink-0" />
      {/* icon-only below 400px so the header fits 320px (the aria-label still names the status) */}
      <span className="truncate max-[400px]:sr-only" lang={pro ? langAttr('en') : undefined}>
        {status}
      </span>
    </Link>
  );
}
