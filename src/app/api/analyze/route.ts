import { DETECTION_SYSTEM_PROMPT, DECISION_QUESTION, buildDetectionUserPrompt } from '@/lib/prompts';
import { PATTERNS } from '@/lib/patterns/catalog';
import { getEntitlement } from '@/lib/server/entitlement';
import { json, readJson } from '@/lib/server/http';
import { ProviderError, chatJson, decide, parseJsonLoose, publicError, resolveAccess, resolveDecisionKey } from '@/lib/server/llm';
import type { AnalyzeChunkRequest, AnalyzeChunkResponse, LlmOut } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const PATTERN_LIST = PATTERNS.map((p) => `${p.id}: ${p.nameEn} (${p.category})`).join('\n');

export async function POST(req: Request) {
  const body = await readJson<AnalyzeChunkRequest>(req);
  if (!body || !Array.isArray(body.sentences) || body.sentences.length === 0 || body.sentences.length > 60) {
    return json({ error: 'bad_request' }, { status: 400 });
  }
  const ent = await getEntitlement(req);
  const secrets = [body.apiKey, body.openrouterKey];
  const out: AnalyzeChunkResponse = { errors: {} };

  const llmTask = (async () => {
    const { provider, apiKey, model } = resolveAccess(ent, body);
    const system = DETECTION_SYSTEM_PROMPT.replaceAll('{{PATTERN_LIST}}', PATTERN_LIST).replaceAll(
      '{{EXPLANATION_LANGUAGE}}',
      body.explanationLanguage === 'he' ? 'Hebrew' : 'English',
    );
    const user = buildDetectionUserPrompt(body.sentences, body.context || '', body.explanationLanguage);
    let text = await chatJson({ provider, apiKey, model, system, user, signal: req.signal });
    let parsed: LlmOut;
    try {
      parsed = parseJsonLoose<LlmOut>(text);
    } catch {
      // one retry: models occasionally truncate or wrap output
      text = await chatJson({ provider, apiKey, model, system, user: user + '\n\nReturn ONLY the JSON object.', signal: req.signal });
      parsed = parseJsonLoose<LlmOut>(text);
    }
    if (!Array.isArray(parsed?.sentences)) throw new ProviderError('missing sentences array', 502, 'bad_response');
    out.llm = parsed;
  })();

  const decisionTask = body.decisionModel
    ? (async () => {
        const apiKey = resolveDecisionKey(ent, body.openrouterKey);
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
  if (l.status === 'rejected') out.errors!.llm = publicError(l.reason, secrets);
  if (d.status === 'rejected') out.errors!.decision = publicError(d.reason, secrets);

  const status = !out.llm && !out.decisions ? (l.status === 'rejected' && l.reason instanceof ProviderError ? l.reason.status : 502) : 200;
  return json(out, { status });
}
