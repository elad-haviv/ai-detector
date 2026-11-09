'use client';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { DEFAULT_LOCALE, dirOf, LANG_COOKIE, LANG_COOKIE_MAX_AGE, type Locale } from './config';
import { getDict, type Dict } from './index';

const LocaleCtx = createContext<Locale>(DEFAULT_LOCALE);

/** Mounted once in the root layout with the locale the server resolved for this request. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Keep <html lang dir> in step after a client-side switch (the server sets them on first paint).
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dirOf(locale);
  }, [locale]);
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleCtx);
}

/** The UI dictionary for the current locale: `const t = useT(); t.nav.history`. */
export function useT(): Dict {
  return getDict(useContext(LocaleCtx));
}

export { currentLocale } from './dom';

/**
 * `lang` attribute for a fragment in another language: `undefined` when it matches the page
 * language (no redundant markup), else the fragment's language. `<span lang={useLangAttr()('en')}>`.
 */
export function useLangAttr(): (lang: Locale) => Locale | undefined {
  const locale = useContext(LocaleCtx);
  return (lang) => (lang === locale ? undefined : lang);
}

/** Writes the `penprint_lang` cookie (12 months). */
export function writeLocaleCookie(locale: Locale) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LANG_COOKIE}=${locale}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * Returns `setLocale(l)`: stores the choice in the cookie, flips <html lang dir> at once and asks the
 * server to re-render the current route in the new language (client state such as an open analysis
 * survives). Nothing is stored server-side.
 */
export function useSetLocale(): (locale: Locale) => void {
  const router = useRouter();
  return useCallback(
    (locale: Locale) => {
      writeLocaleCookie(locale);
      const root = document.documentElement;
      root.lang = locale;
      root.dir = dirOf(locale);
      router.refresh();
    },
    [router],
  );
}
