'use client';
import { PATTERN_BY_ID } from '@/lib/heuristics';
import { he } from '@/lib/i18n/he';
import type { PatternCategory } from '@/lib/patterns/catalog';
import type { Progress } from '@/lib/runAnalysis';
import type { Analysis } from '@/lib/types';
import { BandLegend, CONFIDENCE_LABEL, ScoreRing, scoreBand } from './shared';

export const CATEGORIES: PatternCategory[] = ['vocabulary', 'structure', 'tone', 'formatting', 'rhetoric', 'citation', 'filler'];

export function ScoreCard({ analysis, pending, dirty }: { analysis: Analysis; pending: boolean; dirty: boolean }) {
  const p = analysis.overall.probability;
  const band = scoreBand(p);
  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <ScoreRing value={p} />
        <div>
          <div className="text-[13px] text-muted">{he.results.overallLabel}</div>
          <div className="text-[17px] font-bold">{band.label}</div>
          <div className="text-[13px] text-muted">
            {CONFIDENCE_LABEL[analysis.overall.confidence]}
            {pending && ' · זמני'}
            {!analysis.meta.provider && ' · ניתוח מקומי בלבד'}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[14px]">{band.description}</p>
      {analysis.overall.summary && (
        <p dir="auto" className="mt-2 border-t border-border pt-2 text-[14px] text-muted">
          {analysis.overall.summary}
        </p>
      )}
      {dirty && <p className="mt-2 text-[13px] font-semibold text-warning">בוצעו שינויים. כדאי להריץ ניתוח מחדש.</p>}
      <div className="mt-3">
        <BandLegend />
      </div>
    </div>
  );
}

export function Filters({
  analysis,
  threshold,
  setThreshold,
  enabled,
  toggle,
  flaggedCount,
}: {
  analysis: Analysis;
  threshold: number;
  setThreshold: (n: number) => void;
  enabled: Set<PatternCategory>;
  toggle: (c: PatternCategory) => void;
  flaggedCount: number;
}) {
  const counts: Record<string, number> = {};
  for (const r of Object.values(analysis.results)) {
    const cats = new Set(r.patterns.map((id) => PATTERN_BY_ID[id]?.category).filter(Boolean));
    cats.forEach((c) => (counts[c!] = (counts[c!] || 0) + 1));
  }
  return (
    <div className="card space-y-4 p-4">
      <div>
        <label htmlFor="thr" className="flex items-center justify-between text-[13px] font-semibold">
          <span>{he.threshold.label}</span>
          <span className="tabular-nums">{threshold}%</span>
        </label>
        <input id="thr" type="range" min={0} max={95} step={5} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="mt-1 w-full" />
        <p className="text-[12px] text-muted">
          {he.results.sentencesFlagged.replace('{flagged}', String(flaggedCount)).replace('{total}', String(analysis.sentences.length))}
        </p>
      </div>
      <div>
        <div className="mb-2 text-[13px] font-semibold">{he.filters.byCategory}</div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c, i) => (
            <button
              key={c}
              onClick={() => toggle(c)}
              aria-pressed={enabled.has(c)}
              title={`${i + 1}`}
              className={`min-h-8 rounded-full border px-3 text-[13px] font-semibold ${
                enabled.has(c) ? 'border-accent bg-accent/10 text-text' : 'border-border text-muted line-through'
              }`}
            >
              {he.categories[c]} <span className="tabular-nums text-muted">{counts[c] || 0}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TopPatterns({ analysis, onPick }: { analysis: Analysis; onPick: (patternId: string) => void }) {
  const counts = new Map<string, number>();
  for (const r of Object.values(analysis.results)) for (const id of r.patterns) counts.set(id, (counts.get(id) || 0) + 1);
  const top = [...counts.entries()].filter(([id]) => PATTERN_BY_ID[id]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!top.length) return null;
  return (
    <div className="card p-4">
      <div className="mb-2 text-[13px] font-semibold">דפוסים בולטים</div>
      <ul className="space-y-1">
        {top.map(([id, n]) => (
          <li key={id}>
            <button onClick={() => onPick(id)} className="flex w-full items-center justify-between rounded px-1 py-1 text-start text-[14px] hover:bg-surface-2">
              <span>{PATTERN_BY_ID[id].nameHe}</span>
              <span className="tabular-nums text-muted">×{n}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function level(v: number, lo: number, hi: number) {
  return v < lo ? he.stats.low : v > hi ? he.stats.high : he.stats.medium;
}

export function Stats({ analysis }: { analysis: Analysis }) {
  const s = analysis.stats;
  const tiles = [
    { label: he.stats.burstiness, value: s.burstiness.toFixed(2), note: level(s.burstiness, 0.35, 0.6), hint: he.stats.burstinessHint },
    { label: he.stats.lexicalDiversity, value: s.lexicalDiversity.toFixed(2), note: level(s.lexicalDiversity, 0.65, 0.8), hint: he.stats.lexicalDiversityHint },
    { label: he.stats.avgSentenceLength, value: he.stats.avgSentenceLengthUnit.replace('{value}', String(s.avgSentenceLength)), note: `${s.sentences} משפטים` },
  ];
  return (
    <div className="card p-4">
      <div className="mb-2 text-[13px] font-semibold">{he.stats.title}</div>
      <dl className="grid grid-cols-1 gap-3">
        {tiles.map((t) => (
          <div key={t.label} title={t.hint}>
            <dt className="text-[12px] text-muted">{t.label}</dt>
            <dd className="flex items-baseline gap-2">
              <span className="text-[18px] font-bold tabular-nums">{t.value}</span>
              <span className="text-[12px] text-muted">{t.note}</span>
            </dd>
            {t.hint && <p className="text-[11px] leading-snug text-muted">{t.hint}</p>}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ProgressList({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const done = progress.chunks.filter((c) => c.status === 'done' || c.status === 'failed').length;
  const total = progress.chunks.length;
  const sentencesDone = progress.chunks.filter((c) => c.status === 'done').reduce((a, c) => a + c.size, 0);
  const sentencesTotal = progress.chunks.reduce((a, c) => a + c.size, 0);
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="font-semibold">
          {he.progress.analyzing.replace('{done}', String(sentencesDone)).replace('{total}', String(sentencesTotal))}
        </span>
        <button onClick={onCancel} className="text-muted underline">
          {he.progress.cancel}
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {progress.chunks.map((c, i) => (
          <span
            key={i}
            title={c.error}
            className={`h-1.5 w-5 rounded-full ${
              c.status === 'done' ? 'bg-success' : c.status === 'failed' ? 'bg-danger' : c.status === 'running' ? 'animate-pulse bg-accent' : 'bg-surface-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
