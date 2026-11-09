import { NextResponse } from 'next/server';
import { ASSESS_SYSTEM_PROMPT, DOC_DECISION_QUESTION, buildAssessUserPrompt } from '@/lib/prompts';
import { ProviderError, chatJson, decideDocument, parseJsonLoose, resolveKey } from '@/lib/server/llm';
import type { AssessRequest, AssessResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_WORDS = 7000;

/** Keep long documents within budget: beginning, middle and end paragraphs carry the style. */
function sample(paragraphs: { i: number; text: string }[]) {
  const words = (p: { text: string }) => p.text.split(/\s+/).length;
  const total = paragraphs.reduce((acc, p) => acc + words(p), 0);
  if (total <= MAX_WORDS) return paragraphs;
  const budget = MAX_WORDS / 3;
  const take = (list: typeof paragraphs) => {
    const out: typeof paragraphs = [];
    let n = 0;
    for (const p of list) {
      if (n >= budget) break;
      out.push(p);
      n += words(p);
    }
    return out;
  };
  const mid = Math.floor(paragraphs.length / 2);
  const picked = new Map<number, { i: number; text: string }>();
  for (const p of [...take(paragraphs), ...take(paragraphs.slice(mid)), ...take(paragraphs.slice().reverse())]) picked.set(p.i, p);
  return [...picked.values()].sort((x, y) => x.i - y.i);
}

function errMsg(e: unknown): string {
  if (e instanceof ProviderError) return `${e.code}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

/** Whole-document authorship assessment: language model verdict + optional decision-model verdict. */
export async function POST(req: Request) {
  const b = (await req.json()) as AssessRequest;
  if (!Array.isArray(b.paragraphs) || !b.paragraphs.length) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const shown = sample(b.paragraphs);
  const text = shown.map((p) => p.text).join('\n\n');
  const out: AssessResponse = { errors: {} };

  const llm = (async () => {
    const system = ASSESS_SYSTEM_PROMPT.replaceAll('{{EXPLANATION_LANGUAGE}}', b.explanationLanguage === 'he' ? 'Hebrew' : 'English');
    const call = async () => {
      const raw = await chatJson({
        provider: b.provider,
        apiKey: resolveKey(b.provider, b.apiKey),
        model: b.model,
        system,
        user: buildAssessUserPrompt(shown, b.features),
        maxTokens: 6000,
        signal: req.signal,
      });
      const parsed = parseJsonLoose<NonNullable<AssessResponse['llm']>>(raw);
      if (typeof parsed?.ai_probability !== 'number') throw new ProviderError('missing ai_probability', 502, 'bad_response');
      return parsed;
    };
    let parsed: NonNullable<AssessResponse['llm']>;
    try {
      parsed = await call();
    } catch (e) {
      // one retry for transient upstream errors or malformed JSON (not for bad keys or rate limits)
      if (e instanceof ProviderError && (e.code === 'invalid_key' || e.code === 'missing_key' || e.code === 'rate_limit')) throw e;
      parsed = await call();
    }
    out.llm = {
      ai_probability: Math.max(0, Math.min(100, Math.round(parsed.ai_probability))),
      ai_evidence: (parsed.ai_evidence || []).slice(0, 4),
      human_evidence: (parsed.human_evidence || []).slice(0, 4),
      summary: parsed.summary || '',
      paragraphs: (parsed.paragraphs || [])
        .filter((p) => Number.isFinite(Number(p?.i)) && Number.isFinite(Number(p?.ai_probability)))
        .map((p) => ({ i: Number(p.i), ai_probability: Math.max(0, Math.min(100, Math.round(Number(p.ai_probability)))) })),
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
