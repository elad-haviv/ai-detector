'use client';
import { useState } from 'react';
import { PATTERN_BY_ID } from '@/lib/heuristics';
import { he } from '@/lib/i18n/he';
import type { Sentence, SentenceResult } from '@/lib/types';
import { IconCheck, IconChevron, IconCopy, IconX } from '../icons';
import { BAND_LABEL, bandOf } from './shared';

function HighlightedText({ s, r }: { s: Sentence; r: SentenceResult }) {
  if (!r.hits.length) return <>{s.text}</>;
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const h of [...r.hits].sort((a, b) => a.start - b.start)) {
    if (h.start < pos) continue;
    parts.push(s.text.slice(pos, h.start));
    parts.push(
      <mark key={h.start} className="hit" title={PATTERN_BY_ID[h.patternId]?.nameHe}>
        {s.text.slice(h.start, h.end)}
      </mark>,
    );
    pos = h.end;
  }
  parts.push(s.text.slice(pos));
  return <>{parts}</>;
}

function Signal({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        {value !== undefined && <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />}
      </div>
      <span className="w-10 text-end tabular-nums">{value !== undefined ? `${value}%` : '—'}</span>
    </div>
  );
}

export function Inspector({
  sentence,
  result,
  threshold,
  index,
  total,
  onPrev,
  onNext,
  onClose,
  onApply,
  onIgnore,
  onRewriteParagraph,
  decisionModel,
}: {
  sentence: Sentence;
  result: SentenceResult;
  threshold: number;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onApply: (text: string) => void;
  onIgnore: () => void;
  onRewriteParagraph: () => void;
  decisionModel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const band = bandOf(result.probability, threshold);
  const patterns = result.patterns.map((id) => PATTERN_BY_ID[id]).filter(Boolean);

  return (
    <div className="fade-in flex flex-col gap-4" aria-live="polite">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold">{he.inspector.title}</h2>
        <span className="text-[13px] tabular-nums text-muted">
          {total > 0 && index >= 0 ? `${index + 1}/${total}` : ''}
        </span>
        <div className="ms-auto flex gap-1">
          <button onClick={onPrev} aria-label={he.inspector.previous} title={`${he.inspector.previous} (k)`} className="grid size-9 place-items-center rounded-md hover:bg-surface-2">
            <IconChevron dir="prev" />
          </button>
          <button onClick={onNext} aria-label={he.inspector.next} title={`${he.inspector.next} (j)`} className="grid size-9 place-items-center rounded-md hover:bg-surface-2">
            <IconChevron dir="next" />
          </button>
          <button onClick={onClose} aria-label={he.inspector.close} className="grid size-9 place-items-center rounded-md hover:bg-surface-2">
            <IconX />
          </button>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="text-[40px] font-bold leading-none tabular-nums">{result.probability}%</div>
        <div className="pb-1">
          <div className="text-[13px] text-muted">{he.inspector.probability}</div>
          {band > 0 && <span className={`badge b${band} !ms-0 !align-baseline`}>{BAND_LABEL[band]}</span>}
          {result.status === 'pending' && <span className="text-[13px] text-muted">ממתין לניתוח המודל…</span>}
          {result.status === 'failed' && <span className="text-[13px] text-danger">ניתוח המודל נכשל, מוצג ציון מקומי</span>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Signal label="מודל שפה" value={result.llm} />
        {(decisionModel || result.decision !== undefined) && <Signal label="מודל החלטה" value={result.decision} />}
        <Signal label="כללים מקומיים" value={result.heuristic} />
      </div>

      <blockquote dir="auto" className="doc rounded-md border-s-4 border-border bg-surface-2 p-3 !text-[16px]">
        <HighlightedText s={sentence} r={result} />
      </blockquote>

      <section>
        <h3 className="mb-2 text-[13px] font-bold text-muted">{he.inspector.patternsDetected}</h3>
        {patterns.length === 0 ? (
          <p className="text-[14px] text-muted">{he.inspector.noPatterns}</p>
        ) : (
          <ul className="space-y-2">
            {patterns.map((p) => (
              <li key={p.id} className="rounded-md border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.nameHe}</span>
                  <span className="rounded-full bg-surface-2 px-2 text-[11px] text-muted">{he.categories[p.category]}</span>
                </div>
                <p className="mt-1 text-[13px] text-muted">{p.descriptionHe}</p>
                <p className="mt-1 text-[13px]">
                  <span className="font-semibold">איך לתקן: </span>
                  {p.fixHe}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result.explanation && (
        <section>
          <h3 className="mb-1 text-[13px] font-bold text-muted">{he.inspector.why}</h3>
          <p dir="auto" className="text-[15px]">{result.explanation}</p>
        </section>
      )}

      <section>
        <h3 className="mb-1 text-[13px] font-bold text-muted">{he.inspector.suggestedRewrite}</h3>
        {result.rewrite ? (
          <div className="rounded-md border border-accent/40 p-3">
            <p dir="auto" className="doc !text-[16px]">{result.rewrite}</p>
            <p className="mt-2 text-[12px] text-muted">{he.inspector.rewriteNote}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onApply(result.rewrite!)} className="min-h-10 rounded-md bg-accent px-4 font-semibold text-accent-fg" title="a">
                {he.inspector.apply}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(result.rewrite!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex min-h-10 items-center gap-1.5 rounded-md border border-border px-4 font-semibold"
                title="c"
              >
                {copied ? <IconCheck width={16} /> : <IconCopy width={16} />}
                {copied ? he.inspector.copied : he.inspector.copy}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-muted">
            {result.status === 'heuristic-only' && !result.llm ? 'הצעות ניסוח זמינות אחרי חיבור ספק מודל.' : he.inspector.noRewrite}
          </p>
        )}
      </section>

      {editing !== null && (
        <section>
          <h3 className="mb-1 text-[13px] font-bold text-muted">עריכה ידנית</h3>
          <textarea
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            dir="auto"
            rows={4}
            autoFocus
            className="doc w-full rounded-md border border-border bg-surface p-2 !text-[16px]"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                if (editing.trim() && editing.trim() !== sentence.text) onApply(editing.trim());
                setEditing(null);
              }}
              className="min-h-10 rounded-md bg-accent px-4 font-semibold text-accent-fg"
            >
              שמירה
            </button>
            <button onClick={() => setEditing(null)} className="min-h-10 rounded-md border border-border px-4 font-semibold">
              ביטול
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {editing === null && (
          <button onClick={() => setEditing(sentence.text)} className="min-h-10 rounded-md px-3 text-[14px] font-semibold text-accent hover:bg-surface-2">
            עריכה ידנית
          </button>
        )}
        <button onClick={onIgnore} className="min-h-10 rounded-md px-3 text-[14px] font-semibold text-muted hover:bg-surface-2 hover:text-text">
          {result.ignored ? 'ביטול הסימון כתקין' : he.inspector.ignore}
        </button>
        <button onClick={onRewriteParagraph} className="min-h-10 rounded-md px-3 text-[14px] font-semibold text-accent hover:bg-surface-2">
          {he.results.rewriteParagraph}
        </button>
      </div>
    </div>
  );
}
