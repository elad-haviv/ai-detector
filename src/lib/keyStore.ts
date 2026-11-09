'use client';
import { useSyncExternalStore } from 'react';
import type { ProviderId } from './types';

/**
 * Browser-only API key store, kept apart from the settings object.
 *
 * - Default: session only. Keys live in `sessionStorage` and disappear when the tab closes.
 * - Opt-in "remember on this device": keys live in `localStorage` instead. The presence of the
 *   localStorage record is the remember flag, so it survives reloads even with no keys saved.
 * - Keys never go to our server except inside a single analysis request, and the server never
 *   stores them (see src/lib/server/llm.ts).
 *
 * Migration: before M2 keys were stored inside `kulmus:settings:v1` (localStorage). Those users
 * had chosen persistence implicitly, so their keys move once into the remembered store and are
 * stripped from the settings record.
 */

export type ApiKeys = Partial<Record<ProviderId, string>>;
interface Snapshot {
  keys: ApiKeys;
  remember: boolean;
}

const SESSION_KEY = 'kulmus:keys:session:v1';
const LOCAL_KEY = 'kulmus:keys:v1';
const LEGACY_SETTINGS_KEY = 'kulmus:settings:v1';

const EMPTY: Snapshot = { keys: {}, remember: false };
const listeners = new Set<() => void>();
let cache: Snapshot | null = null;
let migrated = false;

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readRecord(kind: 'local' | 'session'): ApiKeys | null {
  try {
    const raw = storage(kind)?.getItem(kind === 'local' ? LOCAL_KEY : SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { keys?: ApiKeys };
    return clean(parsed.keys || {});
  } catch {
    return null;
  }
}

function clean(keys: ApiKeys): ApiKeys {
  const out: ApiKeys = {};
  for (const [p, v] of Object.entries(keys)) if (typeof v === 'string' && v.trim()) out[p as ProviderId] = v.trim();
  return out;
}

/** One-time move of keys from the old settings record into the remembered store. Idempotent. */
export function migrateLegacyKeys() {
  if (migrated || typeof window === 'undefined') return;
  migrated = true;
  const ls = storage('local');
  if (!ls) return;
  try {
    const raw = ls.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return;
    const settings = JSON.parse(raw) as { keys?: ApiKeys };
    if (!settings || !('keys' in settings)) return;
    const legacy = clean(settings.keys || {});
    if (Object.keys(legacy).length) {
      const existing = readRecord('local') || {};
      ls.setItem(LOCAL_KEY, JSON.stringify({ keys: { ...legacy, ...existing } }));
    }
    delete settings.keys;
    ls.setItem(LEGACY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function read(): Snapshot {
  if (typeof window === 'undefined') return EMPTY;
  if (!cache) {
    migrateLegacyKeys();
    const local = readRecord('local');
    cache = local ? { keys: local, remember: true } : { keys: readRecord('session') || {}, remember: false };
  }
  return cache;
}

function write(next: Snapshot) {
  const keys = clean(next.keys);
  cache = { keys, remember: next.remember };
  const target = next.remember ? storage('local') : storage('session');
  const other = next.remember ? storage('session') : storage('local');
  try {
    other?.removeItem(next.remember ? SESSION_KEY : LOCAL_KEY);
  } catch {}
  try {
    const name = next.remember ? LOCAL_KEY : SESSION_KEY;
    if (!next.remember && !Object.keys(keys).length) target?.removeItem(name);
    else target?.setItem(name, JSON.stringify({ keys }));
  } catch {}
  listeners.forEach((l) => l());
}

/** All keys currently available in this tab. */
export function getKeys(): ApiKeys {
  return read().keys;
}
export function getKey(provider: ProviderId): string | undefined {
  return read().keys[provider];
}
export function hasKeyFor(provider: ProviderId): boolean {
  return Boolean(read().keys[provider]);
}
/** Set (or clear, with an empty string) one provider's key in whichever store is active. */
export function setKey(provider: ProviderId, value: string) {
  const s = read();
  write({ ...s, keys: { ...s.keys, [provider]: value.trim() } });
}
export function isRemembered(): boolean {
  return read().remember;
}
/** Move all keys between this tab (sessionStorage) and this device (localStorage). */
export function setRemember(remember: boolean) {
  const s = read();
  if (s.remember !== remember) write({ ...s, remember });
}
/** Remove every key from both stores and turn "remember" off. */
export function forgetAllKeys() {
  try {
    storage('local')?.removeItem(LOCAL_KEY);
    storage('session')?.removeItem(SESSION_KEY);
  } catch {}
  cache = { keys: {}, remember: false };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // keep tabs in sync when the remembered store changes elsewhere
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL_KEY || e.key === null) {
      cache = null;
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** Reactive view of the key store (empty on the server render). */
export function useKeys(): Snapshot {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
