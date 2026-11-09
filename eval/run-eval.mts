/**
 * Runs every text in eval/texts through the app's real pipeline:
 * local features → POST /api/assess → POST /api/analyze per chunk → blend + overall score.
 * Requires the app running locally (EVAL_BASE, default http://localhost:3100) with provider access.
 * Usage: npx tsx eval/run-eval.mts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { blend, documentPrior, heuristicResults, localDocument, overallScore, sentencePrior, styleScore } from '../src/lib/heuristics';
import { contextFor, documentParagraphs } from '../src/lib/runAnalysis';
import { chunkSentences, segment } from '../src/lib/segment';
import type { Analysis, AnalyzeChunkResponse, AssessResponse, SentenceResult } from '../src/lib/types';

const MIXED: Record<string, { paragraphs: string[] }> = existsSync('eval/texts/mixed.json') ? JSON.parse(readFileSync('eval/texts/mixed.json', 'utf8')) : {};
const BASE = process.env.EVAL_BASE || 'http://localhost:3100';
const CFG = {
  provider: 'openrouter' as const,
  apiKey: 'proxy-injected',
  model: process.env.EVAL_MODEL || 'anthropic/claude-sonnet-5.5',
  decisionModel: process.env.EVAL_DECISION ?? 'typesafe/jev-1.14',
  openrouterKey: 'proxy-injected',
  explanationLanguage: 'he' as const,
};

async function post<T>(path: string, body: unknown): Promise<T> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json()) as T;
    if (res.ok) return json;
    console.error(`  ${path} ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`${path} failed`);
}

async function evaluate(file: string) {
  const text = readFileSync(`eval/texts/${file}`, 'utf8');
  const sentences = segment(text);
  const results: Record<number, SentenceResult> = heuristicResults(sentences);
  const local = localDocument(sentences, results);
  const localOnly = overallScore(sentences, results, undefined, local);

  const paragraphs = documentParagraphs({ sentences } as unknown as Analysis);
  const assess = await post<AssessResponse>('/api/assess', { ...CFG, paragraphs, features: local.features, decisionModel: CFG.decisionModel || undefined });
  if (!assess.llm) console.error(`  assess llm failed for ${file}: ${assess.errors?.llm}`);
  const document = {
    ...local,
    llm: assess.llm?.ai_probability,
    decision: assess.decision,
    aiEvidence: assess.llm?.ai_evidence,
    humanEvidence: assess.llm?.human_evidence,
    summary: assess.llm?.summary,
    paragraphs: assess.llm?.paragraphs?.length ? Object.fromEntries(assess.llm.paragraphs.map((p) => [p.i, p.ai_probability])) : undefined,
    status: assess.llm ? 'done' : 'failed',
  } as const;
  const analysis = { context: '', sentences, results, document } as unknown as Analysis;
  const prior = documentPrior(document);

  const chunkOverall: number[] = [];
  for (const chunk of chunkSentences(sentences, 30, 900)) {
    const data = await post<AnalyzeChunkResponse>('/api/analyze', {
      ...CFG,
      decisionModel: CFG.decisionModel || undefined,
      sentences: chunk.map((s) => ({ id: s.id, text: s.text })),
      context: contextFor(analysis, chunk),
    });
    const byId = new Map((data.llm?.sentences || []).map((x) => [Number(x.id), x]));
    for (const s of chunk) {
      const l = byId.get(s.id);
      const r: SentenceResult = { ...results[s.id], llm: l ? Math.round(l.ai_probability) : undefined, decision: data.decisions?.[s.id], explanation: l?.explanation, status: 'done' };
      const sp = sentencePrior(document, s.paragraph);
      r.probability = blend(r, sp.prior, sp.weight);
      results[s.id] = r;
    }
    if (data.llm?.overall) chunkOverall.push(data.llm.overall.ai_probability);
  }
  const overall = overallScore(sentences, results, chunkOverall.length ? chunkOverall.reduce((a, b) => a + b) / chunkOverall.length : undefined, document);
  const probs = sentences.map((s) => results[s.id].probability);
  const truth = MIXED[file]?.paragraphs;
  const sentenceTruth = truth ? sentences.map((s) => truth[s.paragraph] ?? '?') : undefined;
  // sentence flags if the prior weight were different (offline sensitivity check)
  const flaggedAt = (w: number) =>
    sentences.filter((s) => {
      const r = results[s.id];
      const base = blend({ ...r });
      const sp = sentencePrior(document, s.paragraph);
      return (sp.prior === undefined ? base : base * (1 - w) + w * sp.prior) >= 55;
    }).map((s) => s.id);
  return {
    file,
    label: file.startsWith('human-') ? 'human' : file.startsWith('mixed-') ? 'mixed' : 'ai',
    sentenceTruth,
    sentenceParagraph: sentences.map((s) => s.paragraph),
    sentenceHeuristic: sentences.map((s) => results[s.id].heuristic),
    flaggedIdsAtPrior: { '0.25': flaggedAt(0.25), '0.40': flaggedAt(0.4), '0.55': flaggedAt(0.55) },
    generator: file.startsWith('human-') ? 'wikipedia≤2021' : file.split('-').slice(1, -1).join('-').replace(/-(photosynthesis|industrial|immune|renewable|behaviorism|democracy).*/, ''),
    overall: overall.probability,
    confidence: overall.confidence,
    docLLM: document.llm,
    paragraphScores: document.paragraphs,
    docDecision: document.decision,
    style: document.style,
    prior,
    localOnly: localOnly.probability,
    features: document.features,
    sentences: sentences.length,
    flagged55: probs.filter((p) => p >= 55).length,
    meanSentence: Math.round(probs.reduce((a, b) => a + b, 0) / probs.length),
    sentenceLLM: sentences.map((s) => results[s.id].llm),
    sentenceDecision: sentences.map((s) => results[s.id].decision),
    sentenceFinal: probs,
    aiEvidence: document.aiEvidence,
    humanEvidence: document.humanEvidence,
    summary: document.summary,
  };
}

const files = readdirSync('eval/texts')
  .filter((f) => f.endsWith('.txt') && (!process.env.EVAL_ONLY || f.includes(process.env.EVAL_ONLY)))
  .sort();
const out: Awaited<ReturnType<typeof evaluate>>[] = [];
let i = 0;
await Promise.all(
  Array.from({ length: Number(process.env.EVAL_CONC || 2) }, async () => {
    while (i < files.length) {
      const f = files[i++];
      const r = await evaluate(f);
      out.push(r);
      console.log(`${r.label.padEnd(5)} ${r.overall.toString().padStart(3)}%  doc=${r.docLLM} jev=${r.docDecision} style=${r.style} local=${r.localOnly} flagged=${r.flagged55}/${r.sentences}  ${f}`);
    }
  }),
);
out.sort((a, b) => a.file.localeCompare(b.file));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const path = `eval/results/${stamp}-${CFG.model.replace('/', '_')}.json`;
writeFileSync(path, JSON.stringify({ config: { ...CFG, apiKey: undefined, openrouterKey: undefined }, results: out }, null, 2));
console.log('saved', path);
void styleScore;
