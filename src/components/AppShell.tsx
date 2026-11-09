'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { he } from '@/lib/i18n/he';
import { useApplyTheme, useSettings } from '@/lib/store';
import { IconHistory, IconPen, IconSettings } from './icons';

const NAV = [
  { href: '/', label: he.nav.analyze, Icon: IconPen },
  { href: '/history', label: he.nav.history, Icon: IconHistory },
  { href: '/settings', label: he.nav.settings, Icon: IconSettings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settings] = useSettings();
  useApplyTheme(settings.theme);
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1440px] items-center gap-4 px-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-doc text-2xl font-bold text-accent">{he.appName}</span>
            <span className="hidden text-[13px] text-muted lg:inline">{he.tagline}</span>
          </Link>
          <nav className="ms-auto hidden gap-1 md:flex" aria-label="ניווט ראשי">
            {NAV.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[15px] font-semibold transition-colors ${
                  active(href) ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
                }`}
              >
                <Icon width={18} height={18} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface md:hidden"
        aria-label="ניווט ראשי"
        data-tabbar
      >
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? 'page' : undefined}
            className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${
              active(href) ? 'text-accent' : 'text-muted'
            }`}
          >
            <Icon />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
