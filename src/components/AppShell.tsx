'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import { useApplyTextSize, useApplyTheme, useSettings } from '@/lib/store';
import { OPEN_COOKIE_SETTINGS_EVENT } from '@/lib/consent';
import { AccessChip } from './AccessChip';
import { AccountButton } from './AccountButton';
import { CookieConsent } from './CookieConsent';
import { LanguageSwitch } from './LanguageSwitch';
import { IconHistory, IconPen, IconSettings } from './icons';
import { ToastProvider } from './ui/Toast';

const NAV = [
  { href: '/', key: 'analyze', Icon: IconPen },
  { href: '/history', key: 'history', Icon: IconHistory },
  { href: '/settings', key: 'settings', Icon: IconSettings },
] as const;

/** Event the footer "cookie settings" button dispatches; CookieConsent listens and calls preventDefault(). */
export { OPEN_COOKIE_SETTINGS_EVENT };

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [settings] = useSettings();
  useApplyTheme(settings.theme);
  useApplyTextSize(settings.textSize);
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <ToastProvider>
      <a href="#main" className="skip-link">
        {t.shell.skipToContent}
      </a>
      <div className="flex min-h-dvh flex-col">
        <header className="unstick-short sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
          <div className="mx-auto flex min-h-14 max-w-[1440px] items-center gap-3 px-4 max-[400px]:gap-2 max-[400px]:px-3">
            <Link href="/" className="flex min-h-11 items-center gap-2 rounded-md" aria-label={t.nav.home}>
              <span aria-hidden className="font-doc text-2xl font-bold text-accent">
                {t.appName}
              </span>
            </Link>
            <span aria-hidden className="hidden text-caption text-muted xl:inline">
              {t.tagline}
            </span>

            <nav className="ms-auto hidden md:block" aria-label={t.nav.main}>
              <ul className="flex gap-1">
                {NAV.map(({ href, key, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active(href) ? 'page' : undefined}
                      className={`flex min-h-10 items-center gap-1.5 rounded-md px-3 font-semibold transition-colors ${
                        active(href) ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'
                      }`}
                    >
                      <Icon width={18} height={18} />
                      {t.nav[key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* ── Header status slot ────────────────────────────────────────────
                M2/M3 fill this: access chip (Pro / your key / local rules) and the account button.
                Keep both inside this div so layout stays stable. */}
            <div data-slot="header-status" className="ms-auto flex min-w-0 items-center gap-2 md:ms-2">
              <AccessChip />
              <LanguageSwitch />
              <div data-slot="account-button">
                <AccountButton />
              </div>
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>

        <Footer />
        <CookieConsent />

        <nav className="unstick-short pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface md:hidden" aria-label={t.nav.main} data-tabbar>
          <ul className="flex">
            {NAV.map(({ href, key, Icon }) => (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active(href) ? 'page' : undefined}
                  className={`focus-ring-inset flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active(href) ? 'text-accent' : 'text-muted'}`}
                >
                  <span className={`grid h-7 w-12 place-items-center rounded-full ${active(href) ? 'bg-accent-soft' : ''}`}>
                    <Icon />
                  </span>
                  {t.nav[key]}
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
  const t = useT();
  const router = useRouter();
  const link = 'inline-flex min-h-11 items-center rounded-md px-1 text-muted underline-offset-4 hover:text-text hover:underline';
  return (
    <footer className="tabbar-pad border-t border-border">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-caption">
        <nav aria-label={t.shell.footerNav}>
          <ul className="flex flex-wrap gap-x-4">
            <li>
              <Link href="/privacy" className={link}>
                {t.shell.privacy}
              </Link>
            </li>
            <li>
              <Link href="/terms" className={link}>
                {t.shell.terms}
              </Link>
            </li>
            <li>
              <Link href="/accessibility" className={link}>
                {t.shell.accessibility}
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={link}
                onClick={() => {
                  const ev = new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT, { cancelable: true });
                  // CookieConsent calls preventDefault(); if nothing handled it, go to the cookie policy.
                  if (window.dispatchEvent(ev)) router.push('/privacy#cookies');
                }}
              >
                {t.shell.cookieSettings}
              </button>
            </li>
          </ul>
        </nav>
        <p className="ms-auto text-muted">{t.shell.rights.replace('{year}', String(new Date().getFullYear()))}</p>
      </div>
    </footer>
  );
}
