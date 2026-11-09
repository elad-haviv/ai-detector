'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getAccount, type AccountState } from './account';
import { getKeys, migrateLegacyKeys, type ApiKeys } from './keyStore';
import type { Analysis, ProviderId, Settings } from './types';

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openrouter: 'anthropic/claude-sonnet-5.5',
  google: 'gemini-3.8-flash',
  openai: 'gpt-6.1-terra',
  anthropic: 'claude-sonnet-5-5',
  xai: 'grok-4.3',
};

export const MODEL_SUGGESTIONS: Record<ProviderId, string[]> = {
  openrouter: ['anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5', 'google/gemini-3.8-flash', 'openai/gpt-6.1-terra', 'openai/gpt-6-luna', 'x-ai/grok-4.3'],
  google: ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.1-flash-lite'],
  openai: ['gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-luna'],
  anthropic: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
  xai: ['grok-4.3', 'grok-4.20', 'grok-4.7'],
};

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openrouter',
  models: { ...DEFAULT_MODELS },
  useDecisionModel: true,
  decisionModel: 'typesafe/jev-1.14',
  sensitivity: 'medium',
  explanationLanguage: 'he',
  theme: 'system',
  textSize: 'normal',
  alwaysShowPercent: false,
};

const SETTINGS_KEY = 'kulmus:settings:v1';
const HISTORY_KEY = 'kulmus:history:v1';
const MAX_HISTORY = 40;

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// --- settings: tiny external store so every component sees updates ---
const listeners = new Set<() => void>();
let cache: Settings | null = null;
function readSettings(): Settings {
  if (!cache) {
    // keys used to live in this record: move them to the key store before reading
    migrateLegacyKeys();
    const { keys: _legacy, ...s } = safeGet<Partial<Settings> & { keys?: unknown }>(SETTINGS_KEY, {});
    void _legacy;
    cache = { ...DEFAULT_SETTINGS, ...s, models: { ...DEFAULT_MODELS, ...(s.models || {}) } };
  }
  return cache;
}
/** Current settings outside React render (always the stored values, never the SSR default). */
export function getSettings(): Settings {
  return readSettings();
}
export function saveSettings(next: Settings) {
  cache = next;
  safeSet(SETTINGS_KEY, next);
  listeners.forEach((l) => l());
}
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readSettings,
    () => DEFAULT_SETTINGS,
  );
  const update = useCallback((patch: Partial<Settings>) => saveSettings({ ...readSettings(), ...patch }), []);
  return [s, update];
}

/** True when the chosen provider has a key in the key store (pass `keys` from `useKeys()` in components). */
export function hasKey(s: Settings, keys: ApiKeys = getKeys()): boolean {
  return Boolean(keys[s.provider]?.trim());
}

/**
 * How model calls run right now: the user's own key wins ('byok'); else a Pro subscriber runs on the
 * server's keys ('managed', requests carry no key); else null = local rules only.
 */
export type LlmMode = 'byok' | 'managed' | null;
export function llmMode(s: Settings, keys: ApiKeys = getKeys(), account: Pick<AccountState, 'plan'> = getAccount()): LlmMode {
  if (hasKey(s, keys)) return 'byok';
  if (account.plan === 'pro') return 'managed';
  return null;
}

// --- theme ---
export function useApplyTheme(theme: Settings['theme']) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

// --- text size ---
export function useApplyTextSize(size: Settings['textSize']) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('text-size-large', size === 'large');
    root.classList.toggle('text-size-larger', size === 'larger');
  }, [size]);
}

// --- history ---
export function loadHistory(): Analysis[] {
  return safeGet<Analysis[]>(HISTORY_KEY, []);
}
export function saveToHistory(a: Analysis) {
  const list = loadHistory().filter((x) => x.id !== a.id);
  list.unshift(a);
  let trimmed = list.slice(0, MAX_HISTORY);
  // localStorage is ~5MB; drop oldest entries until it fits
  while (trimmed.length) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
      return;
    } catch {
      trimmed = trimmed.slice(0, -1);
    }
  }
}
export function deleteFromHistory(id: string) {
  safeSet(HISTORY_KEY, loadHistory().filter((x) => x.id !== id));
  import('./blobStore').then((m) => m.deleteFile(id));
}
export function clearHistory() {
  for (const a of loadHistory()) import('./blobStore').then((m) => m.deleteFile(a.id));
  safeSet(HISTORY_KEY, []);
}
export function getFromHistory(id: string): Analysis | undefined {
  return loadHistory().find((x) => x.id === id);
}

export function useHistory() {
  const [items, setItems] = useState<Analysis[]>([]);
  useEffect(() => setItems(loadHistory()), []);
  return {
    items,
    remove: (id: string) => {
      deleteFromHistory(id);
      setItems(loadHistory());
    },
    clear: () => {
      clearHistory();
      setItems([]);
    },
  };
}
