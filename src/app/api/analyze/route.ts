import { NextResponse } from 'next/server';
import { DETECTION_SYSTEM_PROMPT, DECISION_QUESTION, buildDetectionUserPrompt } from '@/lib/prompts';
import { PATTERNS } from '@/lib/patterns/catalog';
import { ProviderError, chatJson, decide, parseJsonLoose, resolveKey } from '@/lib/server/llm';
import type { AnalyzeChunkRequest, AnalyzeChunkResponse, LlmOut } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const PATTERN_LIST = PATTERNS.map((p) => `${p.id}: ${p.nameEn} (${p.category})`).join('\n');

function errMsg(e: unknown): string {
  if (e instanceof ProviderError) return `${e.code}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

export async function POST(req: Request) {
  const body = (await req.json()) as AnalyzeChunkRequest;
  if (!Array.isArray(body.sentences) || body.sentences.length === 0 || body.sentences.length > 60) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const out: AnalyzeChunkResponse = { errors: {} };

  const llmTask = (async () => {
    const apiKey = resolveKey(body.provider, body.apiKey);
    const system = DETECTION_SYSTEM_PROMPT.replaceAll('{{PATTERN_LIST}}', PATTERN_LIST).replaceAll(
      '{{EXPLANATION_LANGUAGE}}',
      body.explanationLanguage === 'he' ? 'Hebrew' : 'English',
    );
    const user = buildDetectionUserPrompt(body.sentences, body.context || '', body.explanationLanguage);
    let text = await chatJson({ provider: body.provider, apiKey, model: body.model, system, user, signal: req.signal });
    let parsed: LlmOut;
    try {
      parsed = parseJsonLoose<LlmOut>(text);
    } catch {
      // one retry: models occasionally truncate or wrap output
      text = await chatJson({ provider: body.provider, apiKey, model: body.model, system, user: user + '\n\nReturn ONLY the JSON object.', signal: req.signal });
      parsed = parseJsonLoose<LlmOut>(text);
    }
    if (!Array.isArray(parsed?.sentences)) throw new ProviderError('missing sentences array', 502, 'bad_response');
    out.llm = parsed;
  })();

  const decisionTask = body.decisionModel
    ? (async () => {
        const apiKey = resolveKey('openrouter', body.openrouterKey);
        out.decisions = await decide({
          apiKey,
          model: body.decisionModel!,
          question: DECISION_QUESTION,
          context: body.context || '',
          sentences: body.sentences,
          signal: req.signal,
        });
      })()
    : Promise.resolve();

  const [l, d] = await Promise.allSettled([llmTask, decisionTask]);
  if (l.status === 'rejected') out.errors!.llm = errMsg(l.reason);
  if (d.status === 'rejected') out.errors!.decision = errMsg(d.reason);

  const status = !out.llm && !out.decisions ? (l.status === 'rejected' && l.reason instanceof ProviderError ? l.reason.status : 502) : 200;
  return NextResponse.json(out, { status });
}
