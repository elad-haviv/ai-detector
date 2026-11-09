'use client';
import { useState } from 'react';
import { useToast } from '../ui';
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
    <div className="flex items-center gap-2 text-caption">
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
  headingId,
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
  /** id for the h2, so a container (the mobile sheet) can be labelled by it. */
  headingId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const editId = `${headingId || 'insp'}-edit`;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast(he.inspector.copiedToast, { tone: 'success' });
    } catch {
      toast(he.inspector.copyFailed, { tone: 'danger' });
    }
  };
  const apply = (text: string) => {
    onApply(text);
    toast(he.inspector.appliedToast, { tone: 'success' });
  };
  const [editing, setEditing] = useState<string | null>(null);
  const band = bandOf(result.probability, threshold);
  const patterns = result.patterns.map((id) => PATTERN_BY_ID[id]).filter(Boolean);

  return (
    <div className="fade-in flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 id={headingId} className="text-ui font-bold">
          {he.inspector.title}
        </h2>
        {total > 0 && index >= 0 && (
          <span className="text-caption tabular-nums text-muted">
            <span aria-hidden>{`${index + 1}/${total}`}</span>
            <span className="sr-only">{he.inspector.position.replace('{index}', String(index + 1)).replace('{total}', String(total))}</span>
          </span>
        )}
        <div className="ms-auto flex gap-1">
          <button type="button" data-nav="prev" onClick={onPrev} aria-label={he.inspector.previous} title={`${he.inspector.previous} (k)`} className="grid size-11 place-items-center rounded-md hover:bg-surface-2">
            <IconChevron dir="prev" />
          </button>
          <button type="button" data-nav="next" onClick={onNext} aria-label={he.inspector.next} title={`${he.inspector.next} (j)`} className="grid size-11 place-items-center rounded-md hover:bg-surface-2">
            <IconChevron dir="next" />
          </button>
          <button type="button" onClick={onClose} aria-label={he.inspector.close} title={`${he.inspector.close} (Esc)`} className="grid size-11 place-items-center rounded-md hover:bg-surface-2">
            <IconX />
          </button>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="text-score font-bold tabular-nums">{result.probability}%</div>
        <div className="pb-1">
          <div className="text-caption text-muted">{he.inspector.probability}</div>
          {band > 0 && <span className={`badge b${band} !ms-0 !align-baseline`}>{BAND_LABEL[band]}</span>}
          {result.status === 'pending' && <span className="text-caption text-muted">{he.inspector.pending}</span>}
          {result.status === 'failed' && <span className="text-caption text-danger">{he.inspector.failed}</span>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Signal label={he.inspector.signalLlm} value={result.llm} />
        {(decisionModel || result.decision !== undefined) && <Signal label={he.inspector.signalDecision} value={result.decision} />}
        <Signal label={he.inspector.signalLocal} value={result.heuristic} />
      </div>

      <blockquote dir="auto" className="doc rounded-md border-s-4 border-border bg-surface-2 p-3 !text-base">
        <HighlightedText s={sentence} r={result} />
      </blockquote>

      <section>
        <h3 className="mb-2 text-caption font-bold text-muted">{he.inspector.patternsDetected}</h3>
        {patterns.length === 0 ? (
          <p className="text-sm text-muted">{he.inspector.noPatterns}</p>
        ) : (
          <ul className="space-y-2">
            {patterns.map((p) => (
              <li key={p.id} className="rounded-md border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.nameHe}</span>
                  <span className="rounded-full bg-surface-2 px-2 text-micro text-muted">{he.categories[p.category]}</span>
                </div>
                <p className="mt-1 text-caption text-muted">{p.descriptionHe}</p>
                <p className="mt-1 text-caption">
                  <span className="font-semibold">{he.inspector.howToFix}</span>
                  {p.fixHe}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result.explanation && (
        <section>
          <h3 className="mb-1 text-caption font-bold text-muted">{he.inspector.why}</h3>
          <p dir="auto" className="text-ui">{result.explanation}</p>
        </section>
      )}

      <section>
        <h3 className="mb-1 text-caption font-bold text-muted">{he.inspector.suggestedRewrite}</h3>
        {result.rewrite ? (
          <div className="rounded-md border border-accent/40 p-3">
            <p dir="auto" className="doc !text-base">{result.rewrite}</p>
            <p className="mt-2 text-xs text-muted">{he.inspector.rewriteNote}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => apply(result.rewrite!)} className="min-h-11 rounded-md bg-accent px-4 font-semibold text-accent-fg" title="a">
                {he.inspector.apply}
              </button>
              <button type="button" onClick={() => copy(result.rewrite!)} className="flex min-h-11 items-center gap-1.5 rounded-md border border-border-strong px-4 font-semibold" title="c">
                {copied ? <IconCheck width={16} /> : <IconCopy width={16} />}
                {copied ? he.inspector.copied : he.inspector.copy}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {result.status === 'heuristic-only' && !result.llm ? he.inspector.rewriteNeedsProvider : he.inspector.noRewrite}
          </p>
        )}
      </section>

      {editing !== null && (
        <section>
          <h3 className="mb-1 text-caption font-bold text-muted">{he.inspector.manualEdit}</h3>
          <label htmlFor={editId} className="sr-only">
            {he.inspector.manualEditLabel}
          </label>
          <textarea
            id={editId}
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            dir="auto"
            rows={4}
            autoFocus
            className="doc control !text-base"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (editing.trim() && editing.trim() !== sentence.text) apply(editing.trim());
                setEditing(null);
              }}
              className="min-h-11 rounded-md bg-accent px-4 font-semibold text-accent-fg"
            >
              {he.inspector.save}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-md border border-border-strong px-4 font-semibold">
              {he.ui.cancel}
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {editing === null && (
          <button type="button" onClick={() => setEditing(sentence.text)} className="min-h-11 rounded-md px-3 text-sm font-semibold text-accent hover:bg-surface-2">
            {he.inspector.manualEdit}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onIgnore();
            toast(result.ignored ? he.inspector.unignoredToast : he.inspector.ignoredToast);
          }}
          className="min-h-11 rounded-md px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text"
        >
          {result.ignored ? he.inspector.unignore : he.inspector.ignore}
        </button>
        <button type="button" onClick={onRewriteParagraph} className="min-h-11 rounded-md px-3 text-sm font-semibold text-accent hover:bg-surface-2">
          {he.results.rewriteParagraph}
        </button>
      </div>
    </div>
  );
}
