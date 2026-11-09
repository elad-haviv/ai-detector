import { REWRITE_SYSTEM_PROMPT } from '@/lib/prompts';
import { getEntitlement } from '@/lib/server/entitlement';
import { json, readJson } from '@/lib/server/http';
import { ProviderError, chatJson, parseJsonLoose, enforceFairUse, publicError, resolveAccess } from '@/lib/server/llm';
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
  const b = await readJson<Body>(req);
  if (!b || typeof b.text !== 'string' || !b.text.trim() || b.text.length > 8000) return json({ error: 'bad_request' }, { status: 400 });
  try {
    const ent = await getEntitlement(req);
    const access = resolveAccess(ent, b);
    enforceFairUse(ent, access);
    const { provider, apiKey, model } = access;
    const system = REWRITE_SYSTEM_PROMPT.replaceAll('{{EXPLANATION_LANGUAGE}}', b.explanationLanguage === 'he' ? 'Hebrew' : 'English');
    const user = `CONTEXT (register only): ${b.context?.trim() || '(none)'}\n\nPARAGRAPH:\n"""\n${b.text}\n"""`;
    const text = await chatJson({ provider, apiKey, model, system, user, maxTokens: 4000, signal: req.signal });
    return json(parseJsonLoose(text));
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 500;
    const code = e instanceof ProviderError ? e.code : 'unknown';
    return json({ error: code, message: publicError(e, [b.apiKey]) }, { status });
  }
}
