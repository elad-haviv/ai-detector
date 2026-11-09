'use client';
import { HEURISTICS_VERSION, blend, computeStats, documentPrior, findHits, heuristicResults, heuristicScore, localDocument, overallScore, sentencePrior } from './heuristics';
import { chunkSentences, detectLang, segment } from './segment';
import { getKey } from './keyStore';
import { hasKey } from './store';
import type { Analysis, AnalyzeChunkRequest, AnalyzeChunkResponse, AssessRequest, AssessResponse, DocumentAssessment, Lang, Sentence, SentenceResult, Settings } from './types';

export type ChunkStatus = 'pending' | 'running' | 'done' | 'failed';
export interface Progress {
  chunks: { status: ChunkStatus; size: number; error?: string }[];
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function explanationLang(s: Settings, text: string): Lang {
  return s.explanationLanguage === 'auto' ? detectLang(text) : s.explanationLanguage;
}

/** Build an analysis with instant local results; LLM results are added by `enrich`. */
export function initialAnalysis(
  text: string,
  title: string,
  context: string,
  settings: Settings,
  opts?: { sentences?: Sentence[]; source?: Analysis['source'] },
): Analysis {
  const sentences = opts?.sentences ?? segment(text);
  const results = heuristicResults(sentences);
  const llmOn = hasKey(settings);
  if (llmOn) for (const r of Object.values(results)) r.status = 'pending';
  const document: DocumentAssessment = { ...localDocument(sentences, results), status: llmOn ? 'pending' : 'local' };
  return {
    id: newId(),
    title: title.trim() || shortTitle(sentences[0]?.text || '') || 'ללא כותרת',
    createdAt: Date.now(),
    context,
    sentences,
    results,
    overall: overallScore(sentences, results, undefined, document),
    stats: computeStats(sentences),
    document,
    meta: {
      provider: llmOn ? settings.provider : undefined,
      model: llmOn ? settings.models[settings.provider] : undefined,
      decisionModel: llmOn && settings.useDecisionModel && getKey('openrouter') ? settings.decisionModel : undefined,
      heuristicsVersion: HEURISTICS_VERSION,
    },
    source: opts?.source,
  };
}

function shortTitle(t: string): string {
  if (t.length <= 50) return t.replace(/[.,:;]+$/, '');
  const cut = t.slice(0, 50);
  return cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : 50).replace(/[.,:;]+$/, '') + '…';
}

export function contextFor(analysis: Analysis, chunk: Sentence[]): string {
  const firstPara = chunk[0].paragraph;
  const prev = analysis.sentences.filter((s) => s.paragraph === firstPara - 1).map((s) => s.text).join(' ');
  const d = analysis.document;
  const assessment =
    d && d.llm !== undefined
      ? `DOCUMENT ASSESSMENT: whole-document AI probability ${documentPrior(d)}% (language model ${d.llm}%, style index ${d.style}%).` +
        (d.aiEvidence?.length ? ` AI evidence: ${d.aiEvidence.join('; ')}.` : '') +
        (d.humanEvidence?.length ? ` Human evidence: ${d.humanEvidence.join('; ')}.` : '')
      : '';
  const paraIds = [...new Set(chunk.map((s) => s.paragraph))];
  const paraLines =
    d?.paragraphs && paraIds.some((pi) => d.paragraphs![pi] !== undefined)
      ? 'PARAGRAPH ASSESSMENT (use as the prior for the sentences in each paragraph):\n' +
        paraIds
          .filter((pi) => d.paragraphs![pi] !== undefined)
          .map((pi) => {
            const ids = chunk.filter((s) => s.paragraph === pi).map((s) => s.id);
            return `¶${pi} (sentence ids ${ids[0]}-${ids[ids.length - 1]}): ${d.paragraphs![pi]}%`;
          })
          .join('\n')
      : '';
  return [assessment, paraLines, analysis.context && `Author's note on the text: ${analysis.context}`, prev && `Previous paragraph: ${prev.slice(-600)}`]
    .filter(Boolean)
    .join('\n');
}

export function errorCode(msg?: string): 'missingKey' | 'invalidKey' | 'rateLimit' | 'badResponse' | 'network' | 'unknown' {
  if (!msg) return 'unknown';
  if (msg.includes('missing_key')) return 'missingKey';
  if (msg.includes('invalid_key')) return 'invalidKey';
  if (msg.includes('rate_limit')) return 'rateLimit';
  if (msg.includes('bad_response')) return 'badResponse';
  if (/fetch|network/i.test(msg)) return 'network';
  return 'unknown';
}

/**
 * Sends sentence chunks to /api/analyze (2 in flight), merging results as they arrive.
 * `onlyIds` re-analyzes a subset (e.g. edited paragraphs).
 */
export async function enrich(
  analysis: Analysis,
  settings: Settings,
  onUpdate: (a: Analysis, p: Progress) => void,
  signal: AbortSignal,
  onlyIds?: Set<number>,
): Promise<Analysis> {
  let a = analysis;
  const targets = onlyIds ? a.sentences.filter((s) => onlyIds.has(s.id)) : a.sentences;
  const chunks = chunkSentences(targets, 30, 900);
  const progress: Progress = { chunks: chunks.map((c) => ({ status: 'pending', size: c.length })) };
  const lang = explanationLang(settings, a.sentences.map((s) => s.text).join(' '));
  const llmOverall: number[] = [];
  let summary: string | undefined = a.overall.summary;

  const emit = () => {
    const ov = overallScore(a.sentences, a.results, llmOverall.length ? llmOverall.reduce((x, y) => x + y, 0) / llmOverall.length : undefined, a.document);
    a = { ...a, overall: { ...ov, summary: a.document?.summary || summary } };
    onUpdate(a, { chunks: progress.chunks.map((c) => ({ ...c })) });
  };
  emit();

  // 1) Whole-document assessment first: it becomes the prior for every sentence.
  if (!onlyIds || a.document?.llm === undefined) {
    const local = localDocument(a.sentences, a.results);
    a = { ...a, document: { ...(a.document || local), ...local, status: 'pending' } };
    emit();
    const body: AssessRequest = {
      provider: settings.provider,
      apiKey: getKey(settings.provider),
      model: settings.models[settings.provider],
      paragraphs: documentParagraphs(a),
      features: local.features,
      explanationLanguage: lang,
      decisionModel: a.meta.decisionModel,
      openrouterKey: getKey('openrouter'),
    };
    try {
      let json: AssessResponse = {};
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
        json = (await res.json()) as AssessResponse;
        if (json.llm || res.status === 401 || res.status === 403 || /invalid_key|missing_key/.test(json.errors?.llm || '')) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      a = {
        ...a,
        document: {
          ...local,
          llm: json.llm?.ai_probability,
          decision: json.decision,
          aiEvidence: json.llm?.ai_evidence,
          humanEvidence: json.llm?.human_evidence,
          summary: json.llm?.summary,
          paragraphs: json.llm?.paragraphs?.length ? Object.fromEntries(json.llm.paragraphs.map((p) => [p.i, p.ai_probability])) : undefined,
          status: json.llm ? 'done' : 'failed',
          error: json.errors?.llm,
        },
      };
    } catch (e) {
      if (signal.aborted) throw e;
      a = { ...a, document: { ...local, status: 'failed', error: e instanceof Error ? e.message : String(e) } };
    }
    emit();
  }

  const runChunk = async (i: number) => {
    const chunk = chunks[i];
    progress.chunks[i].status = 'running';
    emit();
    const body: AnalyzeChunkRequest = {
      provider: settings.provider,
      apiKey: getKey(settings.provider),
      model: settings.models[settings.provider],
      sentences: chunk.map((s) => ({ id: s.id, text: s.text })),
      context: contextFor(a, chunk),
      explanationLanguage: lang,
      decisionModel: a.meta.decisionModel,
      openrouterKey: getKey('openrouter'),
    };
    let data: AnalyzeChunkResponse | null = null;
    let err: string | undefined;
    for (let attempt = 0; attempt < 2 && !data; attempt++) {
      try {
        const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
        const json = (await res.json()) as AnalyzeChunkResponse & { error?: string };
        if (res.ok) data = json;
        else {
          err = json.errors?.llm || json.error || `HTTP ${res.status}`;
          if (res.status === 429) await new Promise((r) => setTimeout(r, 4000));
          else if (res.status < 500) break;
        }
      } catch (e) {
        if (signal.aborted) throw e;
        err = e instanceof Error ? e.message : String(e);
      }
    }
    const results = { ...a.results };
    if (!data) {
      progress.chunks[i] = { ...progress.chunks[i], status: 'failed', error: err };
      for (const s of chunk) results[s.id] = { ...results[s.id], status: 'failed' };
      a = { ...a, results };
      emit();
      return;
    }
    const llmById = new Map((data.llm?.sentences || []).map((x) => [Number(x.id), x]));
    for (const s of chunk) {
      const prev = results[s.id];
      const l = llmById.get(s.id);
      const dec = data.decisions?.[s.id];
      const next: SentenceResult = {
        ...prev,
        llm: l ? clamp(l.ai_probability) : undefined,
        decision: dec,
        explanation: l?.explanation || undefined,
        rewrite: l?.rewrite ?? null,
        patterns: Array.from(new Set([...prev.hits.map((h) => h.patternId), ...((l?.patterns || []) as string[])])),
        status: l || dec !== undefined ? 'done' : 'failed',
      };
      const sp = sentencePrior(a.document, s.paragraph);
      next.probability = blend(next, sp.prior, sp.weight);
      results[s.id] = next;
    }
    if (data.llm?.overall) {
      llmOverall.push(clamp(data.llm.overall.ai_probability));
      if (!summary || chunks.length === 1 || i === 0) summary = data.llm.overall.summary;
    }
    progress.chunks[i] = {
      ...progress.chunks[i],
      status: data.llm ? 'done' : 'failed',
      error: data.errors?.llm || data.errors?.decision,
    };
    a = { ...a, results };
    emit();
  };

  let next = 0;
  const worker = async () => {
    while (next < chunks.length && !signal.aborted) await runChunk(next++);
  };
  await Promise.all(Array.from({ length: Math.min(4, chunks.length) }, worker));
  return a;
}

function clamp(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;
}

/** Replace one sentence's text after the user applies a rewrite; recomputes local signals only. */
export function applyRewrite(a: Analysis, id: number, text: string): Analysis {
  const sentences = a.sentences.map((s) => (s.id === id ? { ...s, text, lang: detectLang(text), words: text.split(/\s+/).filter(Boolean).length } : s));
  const hits = findHits(text);
  const h = heuristicScore(hits);
  const results = {
    ...a.results,
    [id]: { ...a.results[id], heuristic: h, hits, patterns: hits.map((x) => x.patternId), llm: undefined, decision: undefined, probability: h, explanation: undefined, rewrite: null, edited: true, status: 'heuristic-only' as const },
  };
  const document = a.document ? { ...a.document, ...localDocument(sentences, results), status: a.document.status } : undefined;
  return { ...a, sentences, results, document, overall: { ...overallScore(sentences, results, undefined, document), summary: a.overall.summary }, stats: computeStats(sentences) };
}

/** Paragraphs with their index, as sent to the document pass. */
export function documentParagraphs(a: Analysis): { i: number; text: string }[] {
  const paras = new Map<number, string[]>();
  for (const s of a.sentences) (paras.get(s.paragraph) || paras.set(s.paragraph, []).get(s.paragraph)!).push(s.text);
  return [...paras.entries()].sort((x, y) => x[0] - y[0]).map(([i, t]) => ({ i, text: t.join(' ') }));
}

export function documentText(a: Analysis): string {
  const paras: string[][] = [];
  for (const s of a.sentences) (paras[s.paragraph] ||= []).push(s.text);
  return paras.filter(Boolean).map((p) => p.join(' ')).join('\n\n');
}
