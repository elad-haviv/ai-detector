'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount } from '@/lib/account';
import { he } from '@/lib/i18n/he';
import { IconUser } from './icons';

/** Header account entry: avatar initial when signed in, "התחברות" when not. Both go to /account. */
export function AccountButton() {
  const account = useAccount();
  const path = usePathname();
  const current = path.startsWith('/account') ? 'page' : undefined;
  if (!account.loaded) return <span aria-hidden className="inline-block size-9" />;
  if (account.signedIn) {
    const label = account.name || account.email || '';
    const initial = Array.from(label.trim())[0]?.toUpperCase() || '';
    return (
      <Link
        href="/account"
        aria-current={current}
        aria-label={he.shell.accountLabel.replace('{name}', label)}
        title={account.email}
        className="grid size-11 shrink-0 place-items-center rounded-full"
      >
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-fg">
          {initial || <IconUser width={18} height={18} />}
        </span>
      </Link>
    );
  }
  return (
    <Link
      href="/account"
      aria-current={current}
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border-strong px-3 text-caption font-semibold hover:bg-surface-2"
    >
      <IconUser width={16} height={16} />
      {he.shell.signIn}
    </Link>
  );
}
