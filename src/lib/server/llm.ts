/**
 * KEY HANDLING GUARANTEE (read before changing anything in this file or in src/app/api/*):
 *
 * - A browser-supplied API key (BYOK) arrives in the JSON body of ONE request, is passed straight
 *   to the provider's HTTPS API for that request, and is then dropped. It is never logged, never
 *   written to disk, a database, a cache or a cookie, and never kept in module state.
 * - Nothing here or in the API routes logs request bodies, headers or keys. Do not add console.*
 *   calls that could print them.
 * - Upstream error text is scrubbed of the key (and of anything that looks like a key) before it
 *   is returned to the client, and every API response carries `Cache-Control: no-store`.
 * - Server env keys are used ONLY for an entitled (paying) user, decided by `getEntitlement(req)`
 *   in ./entitlement.ts. There is no fallback to env keys for anyone else.
 */
import 'server-only';
import { isProviderId, type ProviderId } from '../types';
import type { Entitlement } from './entitlement';

export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: 'invalid_key' | 'rate_limit' | 'bad_response' | 'missing_key' | 'upstream' | 'bad_request',
  ) {
    super(message);
  }
}

const ENV_KEYS: Record<ProviderId, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  xai: 'XAI_API_KEY',
};

/** Server-side default models for managed (subscription) mode, overridable with MANAGED_MODEL. */
const MANAGED_DEFAULT_MODELS: Record<ProviderId, string> = {
  openrouter: 'anthropic/claude-sonnet-5.5',
  google: 'gemini-3.8-flash',
  openai: 'gpt-6.1-terra',
  anthropic: 'claude-sonnet-5-5',
  xai: 'grok-4.3',
};

export interface Access {
  provider: ProviderId;
  apiKey: string;
  model: string;
  mode: 'byok' | 'managed';
}

/**
 * Decide which provider, key and model a request runs on:
 * 1. the user's own key (BYOK) for the provider they chose, with their model;
 * 2. else, for an entitled subscriber only, the operator's env key in managed mode
 *    (MANAGED_PROVIDER / MANAGED_MODEL, chosen on the server so clients cannot pick costly models);
 * 3. else 401 `missing_key` (the client falls back to local rules only).
 */
export function resolveAccess(ent: Entitlement, req: { provider?: unknown; apiKey?: unknown; model?: unknown }): Access {
  const supplied = typeof req.apiKey === 'string' ? req.apiKey.trim() : '';
  if (supplied) {
    if (!isProviderId(req.provider)) throw new ProviderError('unknown provider', 400, 'bad_request');
    const model = typeof req.model === 'string' && req.model.trim() ? req.model.trim() : MANAGED_DEFAULT_MODELS[req.provider];
    return { provider: req.provider, apiKey: supplied, model, mode: 'byok' };
  }
  if (ent.plan === 'pro') {
    const envProvider = process.env.MANAGED_PROVIDER;
    const provider: ProviderId = isProviderId(envProvider) ? envProvider : 'openrouter';
    const apiKey = process.env[ENV_KEYS[provider]]?.trim();
    if (!apiKey) throw new ProviderError('managed mode is not configured on this server', 503, 'upstream');
    return { provider, apiKey, model: process.env.MANAGED_MODEL?.trim() || MANAGED_DEFAULT_MODELS[provider], mode: 'managed' };
  }
  throw new ProviderError('missing key', 401, 'missing_key');
}

/** Key for the OpenRouter Decisions API: same rule as `resolveAccess` (own key, else entitled env key, else 401). */
export function resolveDecisionKey(ent: Entitlement, supplied?: unknown): string {
  const own = typeof supplied === 'string' ? supplied.trim() : '';
  if (own) return own;
  if (ent.plan === 'pro') {
    const env = process.env.OPENROUTER_API_KEY?.trim();
    if (env) return env;
  }
  throw new ProviderError('missing key', 401, 'missing_key');
}

/** Things that look like API keys, redacted from any text we send back even if we do not know the exact key. */
const KEY_LIKE = /\b(?:sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,}|sk-or-[A-Za-z0-9_-]{8,}|xai-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,})/g;

/** Remove the given secrets (and anything key-shaped) from a message meant for the client. */
export function scrubSecrets(text: string, secrets: (string | undefined)[] = []): string {
  let out = text;
  for (const s of secrets) {
    const k = s?.trim();
    if (k && k.length >= 6) out = out.split(k).join('[redacted]');
  }
  return out.replace(KEY_LIKE, '[redacted]');
}

/** Client-safe error string: `code: message`, scrubbed and length-limited. */
export function publicError(e: unknown, secrets: (string | undefined)[] = []): string {
  const raw = e instanceof ProviderError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
  return scrubSecrets(raw, secrets).slice(0, 600);
}

async function failFrom(res: Response, apiKey: string): Promise<never> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const body = await res.text();
    msg += `: ${body.slice(0, 500)}`;
  } catch {}
  const code = res.status === 401 || res.status === 403 ? 'invalid_key' : res.status === 429 ? 'rate_limit' : 'upstream';
  throw new ProviderError(scrubSecrets(msg, [apiKey]), res.status, code);
}

export interface ChatArgs {
  provider: ProviderId;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

const OPENAI_COMPATIBLE: Partial<Record<ProviderId, string>> = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  xai: 'https://api.x.ai/v1/chat/completions',
};

/** Calls any supported provider and returns raw text (expected to be JSON). */
export async function chatJson({ provider, apiKey, model, system, user, maxTokens = 8000, signal }: ChatArgs): Promise<string> {
  const compatUrl = OPENAI_COMPATIBLE[provider];
  if (compatUrl) {
    const url = compatUrl;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Kulmus AI-writing coach';
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        ...(provider === 'openai' ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      }),
    });
    if (!res.ok) await failFrom(res, apiKey);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new ProviderError('empty response', 502, 'bad_response');
    return text;
  }

  if (provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) await failFrom(res, apiKey);
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    if (!text) throw new ProviderError('empty response', 502, 'bad_response');
    return text;
  }

  // anthropic
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) await failFrom(res, apiKey);
  const data = await res.json();
  const text = (data?.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  if (!text) throw new ProviderError('empty response', 502, 'bad_response');
  return text;
}

/** First complete top-level JSON object in a string (brace matching that respects strings). */
function firstJsonObject(t: string): string | null {
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return t.slice(start, i + 1);
  }
  return null;
}

/** Tolerant JSON extraction: strips code fences, leading prose and anything after the first object. */
export function parseJsonLoose<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(t) as T;
  } catch {
    const obj = firstJsonObject(t);
    if (obj) {
      try {
        return JSON.parse(obj) as T;
      } catch {}
    }
    throw new ProviderError('invalid JSON from model', 502, 'bad_response');
  }
}

/**
 * OpenRouter Decisions API (e.g. TypeSafe Jev): one calibrated yes/no ("noul") question per sentence.
 * Returns id -> probability (0-100) that the sentence is AI-written.
 */
export async function decide(args: {
  apiKey: string;
  model: string;
  question: string;
  context: string;
  sentences: { id: number; text: string }[];
  signal?: AbortSignal;
}): Promise<Record<number, number>> {
  const state = {
    document_context: args.context || '(none)',
    sentences: Object.fromEntries(args.sentences.map((s) => [`s${s.id}`, s.text])),
  };
  const questions = Object.fromEntries(
    args.sentences.map((s) => [
      `s${s.id}`,
      {
        type: 'noul',
        instructions: `${args.question} Evaluate only the sentence under key "s${s.id}" in state.sentences; the others are context.`,
        criteria: {
          true: 'The wording shows AI-style patterns: generic significance claims, stock phrases, formulaic structure, puffery, or over-smooth connectors.',
          false: 'Ordinary human writing, including normal formal academic register, hedging, citations, or plain factual statements.',
        },
      },
    ]),
  );
  const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
    method: 'POST',
    signal: args.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'Kulmus AI-writing coach',
    },
    body: JSON.stringify({ model: args.model, state, questions }),
  });
  if (!res.ok) await failFrom(res, args.apiKey);
  const data = await res.json();
  const out: Record<number, number> = {};
  for (const s of args.sentences) {
    const a = data?.answers?.[`s${s.id}`];
    const p = typeof a?.noul === 'number' ? a.noul : typeof a?.probabilities?.true === 'number' ? a.probabilities.true : undefined;
    if (p !== undefined) out[s.id] = Math.round(p * 100);
  }
  return out;
}

export async function listOpenRouterModels(): Promise<{ id: string; name: string }[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.data || []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }));
}

/** One whole-document yes/no question to a decision model. Returns probability 0-100. */
export async function decideDocument(args: { apiKey: string; model: string; question: string; text: string; signal?: AbortSignal }): Promise<number> {
  const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
    method: 'POST',
    signal: args.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'Kulmus AI-writing coach',
    },
    body: JSON.stringify({
      model: args.model,
      state: args.text,
      questions: {
        doc_ai: {
          type: 'noul',
          instructions: args.question,
          criteria: {
            true: 'Written or mostly written by an AI language model.',
            false: 'Written by a human author (formal academic register alone is not evidence of AI).',
          },
        },
      },
    }),
  });
  if (!res.ok) await failFrom(res, args.apiKey);
  const data = await res.json();
  const a = data?.answers?.doc_ai;
  const p = typeof a?.noul === 'number' ? a.noul : a?.probabilities?.true;
  if (typeof p !== 'number') throw new ProviderError('no decision answer', 502, 'bad_response');
  return Math.round(p * 100);
}
