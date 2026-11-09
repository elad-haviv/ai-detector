import { DEFAULT_LOCALE, isLocale, type Locale } from './config';

/** UI locale outside React (event handlers, analysis runner): read from <html lang>. */
export function currentLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const l = document.documentElement.lang;
  return isLocale(l) ? l : DEFAULT_LOCALE;
}
