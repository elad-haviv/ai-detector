'use client';
import { HIGH_PROBABILITY, PATTERN_BY_ID } from '@/lib/heuristics';
import { he } from '@/lib/i18n/he';
import type { PatternCategory } from '@/lib/patterns/catalog';
import type { Progress } from '@/lib/runAnalysis';
import type { Analysis } from '@/lib/types';
import { CONFIDENCE_LABEL, ScoreRing, scoreBand } from './shared';

export const CATEGORIES: PatternCategory[] = ['vocabulary', 'structure', 'tone', 'formatting', 'rhetoric', 'citation', 'filler'];

function SignalRow({ label, value, note }: { label: string; value?: number; note?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        {value !== undefined && <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />}
      </div>
      <span className="w-12 text-end tabular-nums">{note && value === undefined ? note : value !== undefined ? `${value}%` : '—'}</span>
    </div>
  );
}

export function ScoreCard({ analysis, pending, dirty }: { analysis: Analysis; pending: boolean; dirty: boolean }) {
  const o = analysis.overall;
  const local = o.basis === 'local' || (!o.basis && !analysis.meta.provider);
  const coverage = o.coverage ?? 1;
  const partial = !local && coverage < 0.98;
  const band = scoreBand(o.probability);
  const hits = Object.values(analysis.results).filter((r) => r.hits.length).length;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <ScoreRing value={o.probability} pending={local && pending} />
        <div>
          <div className="text-caption text-muted">סבירות לכתיבה בסגנון AI</div>
          <div className="text-h2 font-bold">{local ? 'ניתוח מקומי בלבד' : band.label}</div>
          <div className="text-caption text-muted">
            {CONFIDENCE_LABEL[o.confidence]}
            {partial && ` · נותחו ${Math.round(coverage * 100)}% מהטקסט`}
            {pending && !partial && !local && ' · זמני'}
          </div>
        </div>
      </div>

      {local ? (
        <p className="mt-3 rounded-md bg-surface-2 p-2 text-caption">
          {pending
            ? 'מודל השפה עדיין קורא את הטקסט. עד שיחזרו תוצאות, המספר מבוסס רק על ביטויים מוכרים ואינו הערכה של הטקסט כולו.'
            : `המספר מבוסס רק על מדדי סגנון ועל ביטויים מוכרים (נמצאו ב-${hits} משפטים), בלי מודל שפה. זו אינדיקציה בלבד: טקסט AI "נקי" וקצר עלול לקבל כאן ציון נמוך. לניתוח מלא צריך לחבר ספק מודל בהגדרות.`}
        </p>
      ) : (
        <p className="mt-3 text-sm">{band.description}</p>
      )}

      {!local && (
        <p className="mt-2 text-caption text-muted">
          {Math.round((o.flaggedShare ?? 0) * 100)}% מהטקסט שנבדק נמצא במשפטים עם סבירות {HIGH_PROBABILITY}% ומעלה.
          {partial && ' הציון יתעדכן כשהניתוח יסתיים.'}
        </p>
      )}

      {analysis.overall.summary && !local && (
        <p dir="auto" className="mt-2 border-t border-border pt-2 text-sm text-muted">
          {analysis.overall.summary}
        </p>
      )}
      {analysis.document && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <div className="text-xs font-semibold text-muted">ממה מורכב הציון</div>
          <SignalRow label="שיפוט המסמך כולו" value={analysis.document.llm} note={analysis.document.status === 'pending' ? 'בודק…' : analysis.document.status === 'failed' ? 'נכשל' : undefined} />
          <SignalRow label="מדד סגנון" value={analysis.document.style} note={analysis.document.features.sentences < 8 ? 'טקסט קצר, משקל נמוך' : undefined} />
          {analysis.document.decision !== undefined && <SignalRow label="מודל החלטה" value={analysis.document.decision} />}
          {(!!analysis.document.aiEvidence?.length || !!analysis.document.humanEvidence?.length) && (
            <details className="pt-1 text-xs">
              <summary className="cursor-pointer font-semibold text-muted">ראיות</summary>
              {!!analysis.document.aiEvidence?.length && (
                <>
                  <div className="mt-1 font-semibold">מצביע על AI</div>
                  <ul className="list-disc space-y-0.5 ps-4">{analysis.document.aiEvidence.map((e, i) => <li key={i} dir="auto">{e}</li>)}</ul>
                </>
              )}
              {!!analysis.document.humanEvidence?.length && (
                <>
                  <div className="mt-1 font-semibold">מצביע על כתיבה אנושית</div>
                  <ul className="list-disc space-y-0.5 ps-4">{analysis.document.humanEvidence.map((e, i) => <li key={i} dir="auto">{e}</li>)}</ul>
                </>
              )}
            </details>
          )}
        </div>
      )}
      {dirty && <p className="mt-2 text-caption font-semibold text-warning">בוצעו שינויים. כדאי להריץ ניתוח מחדש.</p>}

      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer font-semibold">מה המספר אומר?</summary>
        <p className="mt-1 leading-relaxed">
          זו הערכה, לא הוכחה, של עד כמה הטקסט כתוב בסגנון שמאפיין מודלי שפה. כתיבת AI מודרנית ניכרת בעיקר ברמת המסמך: משפטים ארוכים
          ומאוזנים באופן אחיד, רשימות של שלושה שחוזרות, מחברים חלקים, היעדר הפניות ופרטים אישיים. לכן הציון נשען קודם כול על שיפוט המסמך
          כולו בידי מודל השפה ועל מדד סגנון שמחושב מקומית, ורק אחר כך על ממוצע המשפטים ועל מודל ההחלטה. גם ציוני המשפטים מושפעים
          מהשיפוט הכולל, כי משפט נקרא כחלק מהמסמך שלו.
        </p>
      </details>
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
        <label htmlFor="thr" className="flex items-center justify-between text-caption font-semibold">
          <span>{he.threshold.label}</span>
          <span className="tabular-nums">{threshold}%</span>
        </label>
        <input id="thr" type="range" min={0} max={95} step={5} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="mt-1 w-full" />
        <p className="text-xs text-muted">
          {he.results.sentencesFlagged.replace('{flagged}', String(flaggedCount)).replace('{total}', String(analysis.sentences.length))}
        </p>
      </div>
      <div>
        <div className="mb-2 text-caption font-semibold">{he.filters.byCategory}</div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c, i) => (
            <button
              key={c}
              onClick={() => toggle(c)}
              aria-pressed={enabled.has(c)}
              title={`${i + 1}`}
              className={`min-h-8 rounded-full border px-3 text-caption font-semibold ${
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
      <div className="mb-2 text-caption font-semibold">דפוסים בולטים</div>
      <ul className="space-y-1">
        {top.map(([id, n]) => (
          <li key={id}>
            <button onClick={() => onPick(id)} className="flex w-full items-center justify-between rounded px-1 py-1 text-start text-sm hover:bg-surface-2">
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
      <div className="mb-2 text-caption font-semibold">{he.stats.title}</div>
      <dl className="grid grid-cols-1 gap-3">
        {tiles.map((t) => (
          <div key={t.label} title={t.hint}>
            <dt className="text-xs text-muted">{t.label}</dt>
            <dd className="flex items-baseline gap-2">
              <span className="text-lg font-bold tabular-nums">{t.value}</span>
              <span className="text-xs text-muted">{t.note}</span>
            </dd>
            {t.hint && <p className="text-micro leading-snug text-muted">{t.hint}</p>}
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
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-caption">
        <span className="font-semibold" role="status" aria-live="polite">
          {he.progress.analyzing.replace('{done}', String(sentencesDone)).replace('{total}', String(sentencesTotal))}
        </span>
        <button type="button" onClick={onCancel} className="min-h-9 rounded-md px-2 font-semibold text-muted underline hover:text-text">
          {he.progress.cancel}
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={he.progress.analyzing.replace('{done}', String(sentencesDone)).replace('{total}', String(sentencesTotal))} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full bg-accent transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
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
