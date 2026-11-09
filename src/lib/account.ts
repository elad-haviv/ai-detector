'use client';
import { useEffect, useSyncExternalStore } from 'react';
import type { AccountInfo } from './types';

/**
 * Signed-in account state from GET /api/me, as a tiny external store (no SWR).
 * Fetched once on first use, again when the window regains focus (at most every 30 s), and on demand
 * with `refreshAccount()`. The session itself is an HttpOnly cookie the browser holds; this is only
 * a read-out of it.
 */
export interface AccountState extends AccountInfo {
  /** false until the first /api/me answer arrives (render nothing account-dependent before that). */
  loaded: boolean;
}

const INITIAL: AccountState = { loaded: false, signedIn: false, plan: 'free', configured: { google: false, billing: false } };
let state: AccountState = INITIAL;
let inflight: Promise<AccountState> | null = null;
let lastFetch = 0;
const listeners = new Set<() => void>();

function set(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

async function fetchJson(url: string, init?: RequestInit): Promise<AccountState> {
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init });
  const data = (await res.json()) as AccountInfo & { error?: string };
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return { ...data, loaded: true };
}

/** Load (or reuse the in-flight) /api/me. Resolves to the current state; never rejects. */
export function loadAccount(force = false): Promise<AccountState> {
  if (typeof window === 'undefined') return Promise.resolve(state);
  if (!force && state.loaded && Date.now() - lastFetch < 30_000) return Promise.resolve(state);
  if (inflight) return inflight;
  inflight = fetchJson('/api/me')
    .then((s) => {
      set(s);
      return s;
    })
    .catch(() => {
      if (!state.loaded) set({ ...state, loaded: true });
      return state;
    })
    .finally(() => {
      lastFetch = Date.now();
      inflight = null;
    });
  return inflight;
}

/** Ask the server to re-check the subscription with Paddle now; updates the store. */
export async function refreshAccount(): Promise<AccountState> {
  try {
    const s = await fetchJson('/api/account/refresh', { method: 'POST' });
    lastFetch = Date.now();
    set(s);
  } catch {
    await loadAccount(true);
  }
  return state;
}

export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    await loadAccount(true);
  }
}

/** URL that starts Google sign-in and comes back to `returnTo` (a same-origin path). */
export function signInUrl(returnTo = '/account'): string {
  return `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Synchronous snapshot for non-React code (e.g. the analysis runner). */
export function getAccount(): AccountState {
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

let focusBound = false;
function bindFocus() {
  if (focusBound || typeof window === 'undefined') return;
  focusBound = true;
  const onFocus = () => void loadAccount();
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && onFocus());
}

export function useAccount(): AccountState {
  const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  useEffect(() => {
    bindFocus();
    void loadAccount();
  }, []);
  return s;
}
