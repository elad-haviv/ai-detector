/**
 * Locale configuration shared by server and client code (no React, no Next imports).
 *
 * Source of truth: the `penprint_lang` cookie (`he` | `en`, 12 months, a preference cookie that is
 * strictly necessary to show the page in the language you chose). Without the cookie we look at
 * `Accept-Language`: the first of he/iw/en in the visitor's preference order wins, and if neither
 * appears we fall back to Hebrew (the product's home market). See docs/design-spec.md §14.
 */
export type Locale = 'he' | 'en';
export const LOCALES: readonly Locale[] = ['he', 'en'];
export const DEFAULT_LOCALE: Locale = 'he';
export const LANG_COOKIE = 'penprint_lang';
export const LANG_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export function isLocale(v: unknown): v is Locale {
  return v === 'he' || v === 'en';
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

/** BCP 47 tag for Intl formatting (dates, numbers). */
export function intlLocale(locale: Locale): string {
  return locale === 'he' ? 'he-IL' : 'en-US';
}

/** Picks he/en from an Accept-Language header by q-value; null when it names neither. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const prefs = header
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((p) => p.tag && p.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of prefs) {
    const primary = tag.split('-')[0];
    if (primary === 'he' || primary === 'iw') return 'he';
    if (primary === 'en') return 'en';
  }
  return null;
}

/** Cookie first, then Accept-Language, then Hebrew. */
export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/** Replaces `{name}` placeholders. Unknown placeholders are left as they are. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
