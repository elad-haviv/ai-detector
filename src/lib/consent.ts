'use client';

/**
 * Cookie consent record. Stored in the essential cookie `kulmus_consent` (12 months) as
 * `<choice>.<ISO date>`, readable by the page so any future optional script can check it.
 *
 * Today Kulmus uses essential cookies only, so the choice changes nothing at runtime. ANY future
 * analytics or marketing code MUST call `getConsent()` and run only when `analytics` is true.
 */
export type ConsentChoice = 'all' | 'essential';
export interface Consent {
  choice: ConsentChoice;
  date: string;
  /** Optional analytics allowed (none are in use today). */
  analytics: boolean;
}

/** Event the footer "cookie settings" button dispatches (cancelable); CookieConsent handles it. */
export const OPEN_COOKIE_SETTINGS_EVENT = 'kulmus:open-cookie-settings';

export const CONSENT_COOKIE = 'kulmus_consent';
const MAX_AGE = 365 * 24 * 60 * 60;

export function getConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  if (!raw) return null;
  const value = decodeURIComponent(raw);
  const dot = value.indexOf('.');
  const choice = (dot > 0 ? value.slice(0, dot) : value) as ConsentChoice;
  if (choice !== 'all' && choice !== 'essential') return null;
  return { choice, date: dot > 0 ? value.slice(dot + 1) : '', analytics: choice === 'all' };
}

export function setConsent(choice: ConsentChoice): Consent {
  const date = new Date().toISOString().slice(0, 10);
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(`${choice}.${date}`)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
  return { choice, date, analytics: choice === 'all' };
}
