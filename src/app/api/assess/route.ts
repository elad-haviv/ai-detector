import { NextResponse } from 'next/server';
import { ASSESS_SYSTEM_PROMPT, DOC_DECISION_QUESTION, buildAssessUserPrompt } from '@/lib/prompts';
import { ProviderError, chatJson, decideDocument, parseJsonLoose, resolveKey } from '@/lib/server/llm';
import type { AssessRequest, AssessResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_WORDS = 7000;

/** Keep long documents within budget: beginning, middle and end carry the style. */
function sample(text: string): string {
  const words = text.split(/\s+/);
  if (words.length <= MAX_WORDS) return text;
  const part = Math.floor(MAX_WORDS / 3);
  const mid = Math.floor(words.length / 2 - part / 2);
  return [words.slice(0, part).join(' '), words.slice(mid, mid + part).join(' '), words.slice(-part).join(' ')].join('\n\n[…]\n\n');
}

function errMsg(e: unknown): string {
  if (e instanceof ProviderError) return `${e.code}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

/** Whole-document authorship assessment: language model verdict + optional decision-model verdict. */
export async function POST(req: Request) {
  const b = (await req.json()) as AssessRequest;
  if (!b.text?.trim()) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const text = sample(b.text);
  const out: AssessResponse = { errors: {} };

  const llm = (async () => {
    const system = ASSESS_SYSTEM_PROMPT.replaceAll('{{EXPLANATION_LANGUAGE}}', b.explanationLanguage === 'he' ? 'Hebrew' : 'English');
    const raw = await chatJson({
      provider: b.provider,
      apiKey: resolveKey(b.provider, b.apiKey),
      model: b.model,
      system,
      user: buildAssessUserPrompt(text, b.features),
      maxTokens: 3000,
      signal: req.signal,
    });
    const parsed = parseJsonLoose<NonNullable<AssessResponse['llm']>>(raw);
    if (typeof parsed?.ai_probability !== 'number') throw new ProviderError('missing ai_probability', 502, 'bad_response');
    out.llm = {
      ai_probability: Math.max(0, Math.min(100, Math.round(parsed.ai_probability))),
      ai_evidence: (parsed.ai_evidence || []).slice(0, 4),
      human_evidence: (parsed.human_evidence || []).slice(0, 4),
      summary: parsed.summary || '',
    };
  })();
  const decision = b.decisionModel
    ? (async () => {
        out.decision = await decideDocument({
          apiKey: resolveKey('openrouter', b.openrouterKey),
          model: b.decisionModel!,
          question: DOC_DECISION_QUESTION,
          text,
          signal: req.signal,
        });
      })()
    : Promise.resolve();

  const [l, d] = await Promise.allSettled([llm, decision]);
  if (l.status === 'rejected') out.errors!.llm = errMsg(l.reason);
  if (d.status === 'rejected') out.errors!.decision = errMsg(d.reason);
  const status = !out.llm && out.decision === undefined ? (l.status === 'rejected' && l.reason instanceof ProviderError ? l.reason.status : 502) : 200;
  return NextResponse.json(out, { status });
}
