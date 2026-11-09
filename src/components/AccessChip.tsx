'use client';
import Link from 'next/link';
import { he } from '@/lib/i18n/he';
import { useKeys } from '@/lib/keyStore';
import { hasKey, useSettings } from '@/lib/store';
import { IconKey } from './icons';

/**
 * Header status chip: how analysis will run right now.
 * - "Pro" for an active subscriber (M3 hook: `pro` will come from the session; always false today)
 * - "המפתח שלך · <provider>" when the chosen provider has a key in the browser key store
 * - "כללים מקומיים בלבד" otherwise
 */
export function AccessChip({ pro = false }: { pro?: boolean }) {
  const [s] = useSettings();
  const keys = useKeys().keys;
  const keyed = hasKey(s, keys);
  const status = pro ? he.shell.accessPro : keyed ? he.shell.accessKey.replace('{provider}', he.settings.providers[s.provider]) : he.shell.accessLocal;
  return (
    <Link
      href={pro ? '/account' : '/settings#access'}
      aria-label={he.shell.accessChipLabel.replace('{status}', status)}
      className={`inline-flex min-h-9 max-w-[14rem] items-center gap-1.5 truncate rounded-full border px-3 text-caption font-semibold transition-colors hover:bg-surface-2 ${
        pro || keyed ? 'border-success text-success' : 'border-border-strong text-muted'
      }`}
    >
      <IconKey width={16} height={16} className="shrink-0" />
      <span className="truncate">{status}</span>
    </Link>
  );
}
