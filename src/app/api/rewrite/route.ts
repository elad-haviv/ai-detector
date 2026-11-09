import { NextResponse } from 'next/server';
import { REWRITE_SYSTEM_PROMPT } from '@/lib/prompts';
import { ProviderError, chatJson, parseJsonLoose, resolveKey } from '@/lib/server/llm';
import type { ProviderId } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface Body {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  text: string;
  context?: string;
  explanationLanguage: 'he' | 'en';
}

export async function POST(req: Request) {
  const b = (await req.json()) as Body;
  if (!b.text?.trim() || b.text.length > 8000) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    const system = REWRITE_SYSTEM_PROMPT.replaceAll('{{EXPLANATION_LANGUAGE}}', b.explanationLanguage === 'he' ? 'Hebrew' : 'English');
    const user = `CONTEXT (register only): ${b.context?.trim() || '(none)'}\n\nPARAGRAPH:\n"""\n${b.text}\n"""`;
    const text = await chatJson({ provider: b.provider, apiKey: resolveKey(b.provider, b.apiKey), model: b.model, system, user, maxTokens: 4000, signal: req.signal });
    return NextResponse.json(parseJsonLoose(text));
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 500;
    const code = e instanceof ProviderError ? e.code : 'unknown';
    return NextResponse.json({ error: code, message: e instanceof Error ? e.message : String(e) }, { status });
  }
}
