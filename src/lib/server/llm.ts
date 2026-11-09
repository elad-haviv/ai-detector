import 'server-only';
import type { ProviderId } from '../types';

export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: 'invalid_key' | 'rate_limit' | 'bad_response' | 'missing_key' | 'upstream',
  ) {
    super(message);
  }
}

const ENV_KEYS: Record<ProviderId, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

/** Browser-supplied key wins; a server env key is the fallback (and the path for the future paid tier). */
export function resolveKey(provider: ProviderId, supplied?: string): string {
  const key = supplied?.trim() || process.env[ENV_KEYS[provider]];
  if (!key) throw new ProviderError('missing key', 401, 'missing_key');
  return key;
}

async function failFrom(res: Response): Promise<never> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const body = await res.text();
    msg += `: ${body.slice(0, 500)}`;
  } catch {}
  const code = res.status === 401 || res.status === 403 ? 'invalid_key' : res.status === 429 ? 'rate_limit' : 'upstream';
  throw new ProviderError(msg, res.status, code);
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

/** Calls any of the four providers and returns raw text (expected to be JSON). */
export async function chatJson({ provider, apiKey, model, system, user, maxTokens = 8000, signal }: ChatArgs): Promise<string> {
  if (provider === 'openrouter' || provider === 'openai') {
    const url = provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
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
    if (!res.ok) await failFrom(res);
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
    if (!res.ok) await failFrom(res);
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
  if (!res.ok) await failFrom(res);
  const data = await res.json();
  const text = (data?.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  if (!text) throw new ProviderError('empty response', 502, 'bad_response');
  return text;
}

/** Tolerant JSON extraction: strips code fences and leading prose. */
export function parseJsonLoose<T>(text: string): T {
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(t) as T;
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      t = t.slice(start, end + 1);
      return JSON.parse(t) as T;
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
  if (!res.ok) await failFrom(res);
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
  if (!res.ok) await failFrom(res);
  const data = await res.json();
  const a = data?.answers?.doc_ai;
  const p = typeof a?.noul === 'number' ? a.noul : a?.probabilities?.true;
  if (typeof p !== 'number') throw new ProviderError('no decision answer', 502, 'bad_response');
  return Math.round(p * 100);
}
