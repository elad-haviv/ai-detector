import { PATTERNS, type Pattern } from './patterns/catalog';
import type { Analysis, DocStats, PatternHit, Sentence, SentenceResult } from './types';
import { countWords } from './segment';

export const HEURISTICS_VERSION = 'h1';

interface Compiled {
  pattern: Pattern;
  he: RegExp[];
  en: RegExp[];
}

let compiled: Compiled[] | null = null;
function getCompiled(): Compiled[] {
  if (compiled) return compiled;
  const mk = (srcs?: string[]) =>
    (srcs || []).flatMap((s) => {
      try {
        return [new RegExp(s, 'giu')];
      } catch {
        return [];
      }
    });
  compiled = PATTERNS.filter((p) => p.regex).map((p) => ({
    pattern: p,
    he: mk(p.regex?.he),
    en: mk(p.regex?.en),
  }));
  return compiled;
}

export const PATTERN_BY_ID: Record<string, Pattern> = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));

const W = String.raw`[\p{L}\p{M}"'׳״-]+`;
const ITEM = `${W}(?: ${W}){0,2}`;
const TRIAD_RES = [
  // Hebrew: "מעודד חשיבה, מטפח יצירתיות ומעשיר את הלמידה"
  new RegExp(`(?<![\\p{L}])${ITEM}, ${ITEM},? ו-?${ITEM}`, 'gu'),
  // English: "clarity, depth, and nuance"
  new RegExp(String.raw`\b${ITEM}, ${ITEM},? (?:and|or) ${ITEM}`, 'giu'),
];

/** Find lexical pattern hits in a sentence (both languages are checked; mixed text is common). */
export function findHits(text: string): PatternHit[] {
  const hits: PatternHit[] = [];
  for (const c of getCompiled()) {
    for (const re of [...c.he, ...c.en]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (!m[0]) {
          re.lastIndex++;
          continue;
        }
        hits.push({ patternId: c.pattern.id, category: c.pattern.category, match: m[0], start: m.index, end: m.index + m[0].length });
      }
    }
  }
  // Structural patterns the catalog leaves to code: rule of three ("X, Y and Z" / "X, Y ו-Z") with short items.
  const triad = PATTERN_BY_ID['rule-of-three'];
  if (triad) {
    for (const re of TRIAD_RES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) hits.push({ patternId: triad.id, category: triad.category, match: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  // de-duplicate overlapping hits of the same pattern
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  return hits.filter((h, i) => !hits.slice(0, i).some((o) => o.patternId === h.patternId && o.start <= h.start && o.end >= h.end));
}

/** Noisy-OR of fired pattern weights, 0-100. Repeated hits of one pattern count once, slightly boosted. */
export function heuristicScore(hits: PatternHit[]): number {
  const byPattern = new Map<string, number>();
  for (const h of hits) byPattern.set(h.patternId, (byPattern.get(h.patternId) || 0) + 1);
  let keep = 1;
  for (const [id, n] of byPattern) {
    const w = PATTERN_BY_ID[id]?.weight ?? 0.3;
    const eff = Math.min(0.95, w * 0.75 * (1 + 0.15 * (n - 1)));
    keep *= 1 - eff;
  }
  return Math.round((1 - keep) * 100);
}

export function computeStats(sentences: Sentence[]): DocStats {
  const lens = sentences.map((s) => s.words).filter((n) => n > 0);
  const n = lens.length || 1;
  const mean = lens.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const tokens = sentences
    .map((s) => s.text.toLowerCase())
    .join(' ')
    .match(/[\p{L}\p{N}]+/gu) || [];
  // Moving-average TTR, window 50 (robust to length, unlike raw TTR)
  const W = 50;
  let lex = 0;
  if (tokens.length <= W) {
    lex = tokens.length ? new Set(tokens).size / tokens.length : 0;
  } else {
    let sum = 0;
    let count = 0;
    for (let i = 0; i + W <= tokens.length; i += 10) {
      sum += new Set(tokens.slice(i, i + W)).size / W;
      count++;
    }
    lex = sum / count;
  }
  return {
    sentences: sentences.length,
    words: sentences.reduce((a, s) => a + countWords(s.text), 0),
    avgSentenceLength: Math.round(mean * 10) / 10,
    burstiness: mean ? Math.round((sd / mean) * 100) / 100 : 0,
    lexicalDiversity: Math.round(lex * 100) / 100,
  };
}

/** Local, instant analysis used before (and in place of) the LLM. */
export function heuristicResults(sentences: Sentence[]): Record<number, SentenceResult> {
  const out: Record<number, SentenceResult> = {};
  for (const s of sentences) {
    const hits = findHits(s.text);
    const h = heuristicScore(hits);
    out[s.id] = {
      id: s.id,
      heuristic: h,
      probability: h,
      patterns: Array.from(new Set(hits.map((x) => x.patternId))),
      hits,
      status: 'heuristic-only',
    };
  }
  return out;
}

/**
 * Blend available signals. The LLM reads meaning and context, the decision model gives a calibrated
 * yes/no probability, and the lexical rules are precise but shallow, so they get the least weight.
 */
export function blend(r: Pick<SentenceResult, 'heuristic' | 'llm' | 'decision'>): number {
  const parts: [number, number][] = [];
  if (r.llm !== undefined) parts.push([r.llm, 0.6]);
  if (r.decision !== undefined) parts.push([r.decision, 0.25]);
  parts.push([r.heuristic, parts.length ? 0.15 : 1]);
  const wsum = parts.reduce((a, [, w]) => a + w, 0);
  let p = parts.reduce((a, [v, w]) => a + v * w, 0) / wsum;
  // Strong lexical evidence should not be fully washed out by a lenient model.
  if (r.heuristic >= 70) p = Math.max(p, r.heuristic * 0.75);
  return Math.round(Math.max(0, Math.min(100, p)));
}

/**
 * Document score. Once any sentence has a model verdict, only model-checked sentences count:
 * unchecked sentences carry only weak lexical evidence and would drag the score toward 0.
 * `coverage` is the share of words the model has checked; `basis` says what the number rests on.
 */
export function overallScore(
  sentences: Sentence[],
  results: Record<number, SentenceResult>,
  llmOverall?: number,
): Analysis['overall'] {
  const all = sentences.filter((s) => results[s.id] && !results[s.id].ignored);
  const totalWords = all.reduce((a, s) => a + Math.max(1, s.words), 0);
  const checked = all.filter((s) => results[s.id].llm !== undefined || results[s.id].decision !== undefined);
  const basis: 'model' | 'local' = checked.length ? 'model' : 'local';
  const pool = basis === 'model' ? checked : all;

  let wsum = 0;
  let acc = 0;
  let flaggedWords = 0;
  let disagreement = 0;
  for (const s of pool) {
    const r = results[s.id];
    const w = Math.max(1, s.words);
    wsum += w;
    acc += r.probability * w;
    if (r.probability >= 60) flaggedWords += w;
    if (r.llm !== undefined) disagreement += Math.abs(r.llm - (r.decision ?? r.heuristic));
  }
  if (!wsum) return { probability: 0, confidence: 'low', coverage: 0, basis, flaggedShare: 0 };
  const flaggedShare = flaggedWords / wsum;
  let p = 0.6 * (acc / wsum) + 0.4 * flaggedShare * 100;
  if (llmOverall !== undefined && basis === 'model') p = 0.6 * p + 0.4 * llmOverall;
  const coverage = basis === 'model' ? wsum / totalWords : 0;
  const avgDis = checked.length ? disagreement / checked.length : 100;
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (basis === 'local' || wsum < 120 || avgDis > 40 || coverage < 0.5) confidence = 'low';
  else if (wsum >= 300 && avgDis < 22 && coverage >= 0.9) confidence = 'high';
  return { probability: Math.round(p), confidence, coverage: Math.round(coverage * 100) / 100, basis, flaggedShare: Math.round(flaggedShare * 100) / 100 };
}

export function sensitivityThreshold(s: 'low' | 'medium' | 'high'): number {
  return s === 'low' ? 70 : s === 'high' ? 40 : 55;
}
