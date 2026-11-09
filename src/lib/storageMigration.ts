'use client';

/**
 * One-time move of browser storage from the app's former name ("kulmus") to "penprint" (M5 rename).
 *
 * For each old key: if the new key is empty, copy the value across; then delete the old key. It runs
 * synchronously before the stores first read (settings, history, keys, onboarding flag), is
 * idempotent, and costs one getItem per key after it has run. sessionStorage is per tab, so it runs
 * again in each tab that still holds an old session key. The IndexedDB file store is migrated
 * lazily in blobStore.ts. Old cookies (kulmus_session / kulmus_consent / kulmus_oauth) are simply
 * ignored: the user signs in or answers the cookie notice again.
 *
 * Settings: the old default explanation language was 'he' (the UI was Hebrew-only), so a stored
 * 'he' becomes 'ui' ("same as interface"), which is still Hebrew for a Hebrew UI. 'en' and 'auto'
 * were deliberate choices and are kept.
 */
const LEGACY_PREFIX = 'kulmus:';
const PREFIX = 'penprint:';
const LOCAL_KEYS = ['settings:v1', 'history:v1', 'keys:v1', 'onboarded:v1'];
const SESSION_KEYS = ['keys:session:v1'];

let done = false;

function move(store: Storage, name: string, transform?: (raw: string) => string) {
  const from = LEGACY_PREFIX + name;
  const old = store.getItem(from);
  if (old === null) return;
  const to = PREFIX + name;
  if (store.getItem(to) === null) store.setItem(to, transform ? transform(old) : old);
  store.removeItem(from);
}

function migrateSettings(raw: string): string {
  try {
    const s = JSON.parse(raw) as { explanationLanguage?: string };
    if (s && s.explanationLanguage === 'he') s.explanationLanguage = 'ui';
    return JSON.stringify(s);
  } catch {
    return raw;
  }
}

export function migrateLegacyStorage() {
  if (done || typeof window === 'undefined') return;
  done = true;
  try {
    const ls = window.localStorage;
    for (const k of LOCAL_KEYS) move(ls, k, k === 'settings:v1' ? migrateSettings : undefined);
  } catch {}
  try {
    const ss = window.sessionStorage;
    for (const k of SESSION_KEYS) move(ss, k);
  } catch {}
}
