#!/usr/bin/env node
/**
 * Penprint engine for the penprint-docx skill. Reuses the site's own code (src/lib), so scores match.
 *
 *   node --import ./register.mjs --experimental-strip-types --no-warnings penprint.mjs <command> ...
 *   (use run.sh, which sets the flags)
 *
 *   analyze <blocks.json> <analysis.json> <rubric.md>
 *       Split blocks into sentences, run the local pattern rules and style metrics, and write the
 *       rubric (the site's three prompts with the pattern list filled in) for Claude to follow.
 *   score <analysis.json> <judgments.json|-> <scored.json> [--threshold N] [--lang he|en] [--keep-placeholders]
 *       Blend Claude's judgments with the local signals exactly as the site does, choose which
 *       rewrites to apply, and write everything the report needs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// In the repo the engine imports src/lib directly; an installed copy carries a vendored src/lib (see install.sh).
const here = fileURLToPath(new URL('.', import.meta.url));
const LIB = existsSync(here + '../vendor/lib') ? '../vendor/lib/' : '../../../../src/lib/';
const imp = (p) => import(new URL(LIB + p, import.meta.url).href);
const { he } = await imp('i18n/he.ts');
const { en } = await imp('i18n/en.ts');
const { PATTERNS } = await imp('patterns/catalog.ts');
const { PATTERN_TEXT_EN } = await imp('patterns/catalog.en.ts');
const { ASSESS_SYSTEM_PROMPT, DETECTION_SYSTEM_PROMPT, REWRITE_SYSTEM_PROMPT, buildAssessUserPrompt } = await imp('prompts.ts');
const { chunkSentences, countWords, detectLang, splitSentences } = await imp('segment.ts');
const {
  HEURISTICS_VERSION, HIGH_PROBABILITY, PATTERN_BY_ID, blend, computeStats, heuristicResults,
  localDocument, overallScore, sentencePrior,
} = await imp('heuristics.ts');

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const k = rest[i].slice(2);
    flags[k] = ['keep-placeholders'].includes(k) ? true : rest[++i];
  } else args.push(rest[i]);
}
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const write = (p, o) => writeFileSync(p, typeof o === 'string' ? o : JSON.stringify(o, null, 2));
const clamp = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.min(100, Math.round(Number(n)))) : 0);
const PLACEHOLDER = /\[[^\]\n]{2,60}\]/; // "[לציין איזה ממצא]", "[specify which finding]", "[מקור]"
const CITATION_BRACKET = /^\[\d+(?:\s*[,–-]\s*\d+)*\]$/;
const hasPlaceholder = (s) => (s.match(new RegExp(PLACEHOLDER, 'g')) || []).some((m) => !CITATION_BRACKET.test(m));

// Not prose: code listings, bibliography entries, equations/units, labels and fragments. They are not judged,
// not edited, and do not count toward the score or the style metrics.
const CODE = /[=;{}]|^\s*%|\\[a-z]+|\b(?:function|end|if|for|while|return|clear|plot|figure)\b\s*[(\w]|^['"\w]+\s*[=(]|\.\.\.\s*$/;
const REFERENCE = /\b(?:vol\.|pp\.|no\.\s*\d|Proc\.|IEEE|Trans(?:actions)?\b|doi|ISBN|Press|Publishers?|Conf\.|Jour(?:nal)?\b)/i;
export function isProse(t, words) {
  const letters = (t.match(/\p{L}/gu) || []).length;
  if (words < 5 || letters / Math.max(1, t.length) < 0.6) return false;
  if (CODE.test(t) && !/[.!?:]$/.test(t.trim())) return false;
  if (/^\s*(?:\d+(?:\.\d+)*\.?\s*)?\S+(?:\s+\S+){0,3}\s*$/.test(t) && !/[.!?]$/.test(t.trim())) return false; // heading-like
  if (REFERENCE.test(t) && /(?:19|20)\d{2}/.test(t) && /,/.test(t) && words > 8 && !/\bאת\b|\bהוא\b|\bthe\b/i.test(t.slice(0, 40)) && /(?:vol\.|pp\.|IEEE|Proc\.|ISBN|doi)/i.test(t)) return false;
  return true;
}

function analyze([blocksPath, outPath, rubricPath]) {
  const { blocks, source } = read(blocksPath);
  const sentences = [];
  let id = 0;
  blocks.forEach((b, bi) => {
    for (const s of splitSentences(b.text)) sentences.push({ id: id++, paragraph: bi, text: s, lang: detectLang(s), words: countWords(s), ...(b.obj ? { obj: true } : {}) });
  });
  if (!sentences.length) throw new Error('no text found in the document');
  const results = heuristicResults(sentences);
  for (const s of sentences) if (!isProse(s.text, s.words)) results[s.id].ignored = true;
  const prose = sentences.filter((s) => !results[s.id].ignored);
  if (!prose.length) throw new Error('no prose found in the document');
  const doc = localDocument(prose, results);
  const paragraphs = [];
  for (const s of prose) (paragraphs[s.paragraph] ||= []).push(s.text);
  const paras = paragraphs.map((t, i) => (t ? { i, text: t.join(' ') } : null)).filter(Boolean);
  const text = prose.map((s) => s.text).join(' ');
  const out = {
    source,
    heuristicsVersion: HEURISTICS_VERSION,
    textLang: detectLang(text),
    sentences,
    results,
    stats: computeStats(prose),
    ignored: sentences.length - prose.length,
    features: doc.features,
    paragraphs: paras,
    chunks: chunkSentences(prose, 30, 900).map((c) => c.map((s) => s.id)),
  };
  write(outPath, out);

  const patternList = PATTERNS.map((p) => `${p.id}: ${p.nameEn} (${p.category})`).join('\n');
  const explLang = out.textLang === 'he' ? 'Hebrew' : 'English';
  const fill = (s) => s.replaceAll('{{PATTERN_LIST}}', patternList).replaceAll('{{EXPLANATION_LANGUAGE}}', explLang);
  const rubric = [
    '# Penprint rubric (generated from src/lib/prompts.ts; do not edit)',
    '',
    `Explanation language for this document: **${explLang}**.`,
    '',
    '## Pass 1: whole-document assessment',
    '',
    fill(ASSESS_SYSTEM_PROMPT),
    '',
    '### Pass 1 user message (fill-in)',
    '',
    buildAssessUserPrompt(paras.slice(0, 40), doc.features),
    '',
    '## Pass 2: sentence-by-sentence detection and rewrites',
    '',
    fill(DETECTION_SYSTEM_PROMPT),
    '',
    '## Optional: paragraph rewrite (only if a whole paragraph needs a fresh pass)',
    '',
    fill(REWRITE_SYSTEM_PROMPT),
    '',
  ].join('\n');
  write(rubricPath, rubric);
  console.log(JSON.stringify({ sentences: sentences.length, paragraphs: paras.length, words: out.stats.words, chunks: out.chunks.length, proseSentences: prose.length, ignored: sentences.length - prose.length, localHits: prose.filter((x) => results[x.id].hits.length).length }));
}

function score([analysisPath, judgmentsPath, outPath]) {
  const a = read(analysisPath);
  const j = judgmentsPath && judgmentsPath !== '-' ? read(judgmentsPath) : null;
  const threshold = flags.threshold !== undefined ? Number(flags.threshold) : 55; // site's "medium" sensitivity
  const lang = flags.lang || a.textLang;
  const results = { ...a.results };
  const prose = a.sentences.filter((s) => !results[s.id].ignored);
  const local = localDocument(prose, results);
  const d = j?.document;
  const document = {
    ...local,
    llm: d ? clamp(d.ai_probability) : undefined,
    aiEvidence: d?.ai_evidence,
    humanEvidence: d?.human_evidence,
    summary: d?.summary,
    paragraphs: d?.paragraphs?.length ? Object.fromEntries(d.paragraphs.map((p) => [p.i, clamp(p.ai_probability)])) : undefined,
    status: d ? 'done' : 'local',
  };
  const byId = new Map((j?.sentences || []).map((x) => [Number(x.id), x]));
  for (const s of a.sentences) {
    const prev = results[s.id];
    const l = byId.get(s.id);
    const next = {
      ...prev,
      llm: l ? clamp(l.ai_probability) : undefined,
      explanation: l?.explanation || undefined,
      rewrite: l?.rewrite ?? null,
      patterns: [...new Set([...prev.hits.map((h) => h.patternId), ...((l?.patterns || []).filter((p) => PATTERN_BY_ID[p]))])],
      status: l ? 'done' : 'heuristic-only',
    };
    const sp = sentencePrior(document, s.paragraph);
    next.probability = blend(next, sp.prior, sp.weight);
    if (next.ignored) Object.assign(next, { probability: 0, patterns: [], rewrite: null, explanation: undefined });
    results[s.id] = next;
  }
  const overall = { ...overallScore(a.sentences, results, undefined, document), summary: document.summary };
  const judged = byId.size > 0;

  // Which rewrites get applied: flagged sentences with a usable rewrite.
  const decisions = {};
  for (const s of a.sentences) {
    const r = results[s.id];
    let action = 'keep';
    let reason;
    if (!r.ignored && r.probability >= threshold) {
      if (!r.rewrite) { action = 'flagged'; reason = judged ? 'noRewrite' : 'localOnly'; }
      else if (s.obj) { action = 'flagged'; reason = 'hasObject'; }
      else if (r.rewrite.trim() === s.text.trim()) { action = 'flagged'; reason = 'noRewrite'; }
      else if (hasPlaceholder(r.rewrite) && !flags['keep-placeholders']) { action = 'flagged'; reason = 'needsInput'; }
      else action = 'apply';
    }
    decisions[s.id] = { action, reason };
  }

  const patternIds = new Set(Object.values(results).flatMap((r) => r.patterns));
  const patterns = Object.fromEntries(
    [...patternIds].filter((id) => PATTERN_BY_ID[id]).map((id) => {
      const p = PATTERN_BY_ID[id];
      const en = PATTERN_TEXT_EN[id];
      return [id, { category: p.category, nameHe: p.nameHe, nameEn: p.nameEn, fixHe: p.fixHe, fixEn: en?.fix ?? p.fixHe }];
    }),
  );
  const applied = a.sentences.filter((s) => decisions[s.id].action === 'apply');
  write(outPath, {
    source: a.source,
    lang,
    threshold,
    highProbability: HIGH_PROBABILITY,
    judged,
    sentences: a.sentences,
    results,
    decisions,
    overall,
    document,
    stats: a.stats,
    patterns,
    // the site's own score-band and confidence wording, so the report speaks like the UI
    ui: { he: { bands: he.results.scoreBands, confidence: he.results.confidence }, en: { bands: en.results.scoreBands, confidence: en.results.confidence } },
    // after-fix estimate: local signals only (rewrites are not re-judged by a model)
    edits: applied.map((s) => ({ id: s.id, block: s.paragraph, old: s.text, new: results[s.id].rewrite.trim() })),
  });
  const flagged = a.sentences.filter((s) => !results[s.id].ignored && results[s.id].probability >= threshold).length;
  console.log(JSON.stringify({ overall, judged, flagged, willApply: applied.length, needInput: a.sentences.filter((s) => decisions[s.id].reason === 'needsInput').length, threshold }));
}

if (cmd === 'analyze') analyze(args);
else if (cmd === 'score') score(args);
else {
  console.error('usage: penprint.mjs analyze <blocks.json> <analysis.json> <rubric.md> | score <analysis.json> <judgments.json|-> <scored.json> [--threshold N] [--lang he|en] [--keep-placeholders]');
  process.exit(2);
}
