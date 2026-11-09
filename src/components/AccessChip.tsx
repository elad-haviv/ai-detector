'use client';
import Link from 'next/link';
import { he } from '@/lib/i18n/he';
import { hasKey, useSettings } from '@/lib/store';
import { IconKey } from './icons';

/**
 * Header status chip: how analysis will run right now. M1 derives it from local settings
 * (provider with a key, else local rules only). M2/M3 extend it (subscription "Pro", BYOK storage).
 */
export function AccessChip() {
  const [s] = useSettings();
  const keyed = hasKey(s);
  const status = keyed ? he.shell.accessKey.replace('{provider}', he.settings.providers[s.provider]) : he.shell.accessLocal;
  return (
    <Link
      href="/settings#access"
      aria-label={he.shell.accessChipLabel.replace('{status}', status)}
      className={`inline-flex min-h-9 max-w-[14rem] items-center gap-1.5 truncate rounded-full border px-3 text-caption font-semibold transition-colors hover:bg-surface-2 ${
        keyed ? 'border-success text-success' : 'border-border-strong text-muted'
      }`}
    >
      <IconKey width={16} height={16} className="shrink-0" />
      <span className="truncate">{status}</span>
    </Link>
  );
}
