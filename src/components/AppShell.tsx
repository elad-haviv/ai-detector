'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { he } from '@/lib/i18n/he';
import { useApplyTextSize, useApplyTheme, useSettings } from '@/lib/store';
import { AccessChip } from './AccessChip';
import { IconHistory, IconPen, IconSettings } from './icons';
import { ToastProvider, useToast } from './ui/Toast';

const NAV = [
  { href: '/', label: he.nav.analyze, Icon: IconPen },
  { href: '/history', label: he.nav.history, Icon: IconHistory },
  { href: '/settings', label: he.nav.settings, Icon: IconSettings },
];

/** Event the footer "cookie settings" button dispatches; the consent banner (M3) listens for it. */
export const OPEN_COOKIE_SETTINGS_EVENT = 'kulmus:open-cookie-settings';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settings] = useSettings();
  useApplyTheme(settings.theme);
  useApplyTextSize(settings.textSize);
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <ToastProvider>
      <a href="#main" className="skip-link">
        {he.shell.skipToContent}
      </a>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4">
            <Link href="/" className="flex min-h-11 items-center gap-2 rounded-md" aria-label={he.nav.home}>
              <span aria-hidden className="font-doc text-2xl font-bold text-accent">
                {he.appName}
              </span>
            </Link>
            <span aria-hidden className="hidden text-caption text-muted xl:inline">
              {he.tagline}
            </span>

            <nav className="ms-auto hidden md:block" aria-label={he.nav.main}>
              <ul className="flex gap-1">
                {NAV.map(({ href, label, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active(href) ? 'page' : undefined}
                      className={`flex min-h-10 items-center gap-1.5 rounded-md px-3 font-semibold transition-colors ${
                        active(href) ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'
                      }`}
                    >
                      <Icon width={18} height={18} />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* ── Header status slot ────────────────────────────────────────────
                M2/M3 fill this: access chip (Pro / your key / local rules) and the account button.
                Keep both inside this div so layout stays stable. */}
            <div data-slot="header-status" className="ms-auto flex items-center gap-2 md:ms-2">
              <AccessChip />
              {/* data-slot="account-button": M3 adds the sign-in / avatar button here. */}
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>

        <Footer />

        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface md:hidden" aria-label={he.nav.main} data-tabbar>
          <ul className="flex">
            {NAV.map(({ href, label, Icon }) => (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active(href) ? 'page' : undefined}
                  className={`focus-ring-inset flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active(href) ? 'text-accent' : 'text-muted'}`}
                >
                  <span className={`grid h-7 w-12 place-items-center rounded-full ${active(href) ? 'bg-accent-soft' : ''}`}>
                    <Icon />
                  </span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </ToastProvider>
  );
}

function Footer() {
  const toast = useToast();
  const link = 'inline-flex min-h-11 items-center rounded-md px-1 text-muted underline-offset-4 hover:text-text hover:underline';
  return (
    <footer className="border-t border-border pb-20 md:pb-0">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-caption">
        <nav aria-label={he.shell.footerNav}>
          <ul className="flex flex-wrap gap-x-4">
            <li>
              <Link href="/privacy" className={link}>
                {he.shell.privacy}
              </Link>
            </li>
            <li>
              <Link href="/terms" className={link}>
                {he.shell.terms}
              </Link>
            </li>
            <li>
              <Link href="/accessibility" className={link}>
                {he.shell.accessibility}
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={link}
                onClick={() => {
                  const ev = new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT, { cancelable: true });
                  // If nothing handles it yet (before M3), explain instead of doing nothing.
                  if (window.dispatchEvent(ev)) toast(he.shell.cookieSettingsSoon);
                }}
              >
                {he.shell.cookieSettings}
              </button>
            </li>
          </ul>
        </nav>
        <p className="ms-auto text-muted">{he.shell.rights.replace('{year}', String(new Date().getFullYear()))}</p>
      </div>
    </footer>
  );
}
