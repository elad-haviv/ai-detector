'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PATTERN_BY_ID, sensitivityThreshold } from '@/lib/heuristics';
import { he } from '@/lib/i18n/he';
import type { PatternCategory } from '@/lib/patterns/catalog';
import { errorCode, explanationLang, type Progress } from '@/lib/runAnalysis';
import { groupParagraphs } from '@/lib/segment';
import { useSettings } from '@/lib/store';
import type { Analysis, SentenceResult } from '@/lib/types';
import { getFile } from '@/lib/blobStore';
import { buildEditedDocx } from '@/lib/docx/model';
import { IconDownload, IconFilter, IconRefresh, IconX } from '../icons';
import { DocxView, type Decor } from './DocxView';
import { Inspector } from './Inspector';
import { CATEGORIES, Filters, ProgressList, ScoreCard, Stats, TopPatterns } from './SummaryPanel';
import { BAND_LABEL, CONFIDENCE_LABEL, ScoreRing, bandOf } from './shared';

interface Props {
  analysis: Analysis;
  progress: Progress | null;
  running: boolean;
  dirty: boolean;
  onApply: (id: number, text: string) => void;
  onToggleIgnore: (id: number) => void;
  onReplaceParagraph: (paragraph: number, text: string) => void;
  onReanalyze: () => void;
  onCancel: () => void;
  onNew: () => void;
}

export function ResultsView(props: Props) {
  const { analysis, progress, running, dirty } = props;
  const [settings] = useSettings();
  const [threshold, setThreshold] = useState(() => sensitivityThreshold(settings.sensitivity));
  const [enabled, setEnabled] = useState<Set<PatternCategory>>(new Set(CATEGORIES));
  const [patternFilter, setPatternFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheetFull, setSheetFull] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [paraRewrite, setParaRewrite] = useState<{ paragraph: number; loading: boolean; text?: string; changes?: string[]; error?: string } | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [docxUnavailable, setDocxUnavailable] = useState(false);
  const [preferText, setPreferText] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isDocx = analysis.source?.kind === 'docx' && !docxUnavailable;
  const showDocx = isDocx && !preferText;

  const visible = useCallback(
    (r: SentenceResult | undefined) => {
      if (!r || r.ignored) return false;
      if (r.probability < threshold) return false;
      if (patternFilter) return r.patterns.includes(patternFilter);
      if (enabled.size === CATEGORIES.length || r.patterns.length === 0) return true;
      return r.patterns.some((id) => enabled.has(PATTERN_BY_ID[id]?.category as PatternCategory));
    },
    [threshold, enabled, patternFilter],
  );

  const flaggedIds = useMemo(() => analysis.sentences.filter((s) => visible(analysis.results[s.id])).map((s) => s.id), [analysis, visible]);
  const paragraphs = useMemo(() => groupParagraphs(analysis.sentences), [analysis.sentences]);

  const decor = useCallback(
    (id: number): Decor => {
      const r = analysis.results[id];
      const band = visible(r) ? bandOf(r.probability, threshold) : 0;
      const showBadge = band >= 2 || (band === 1 && settings.alwaysShowPercent);
      return {
        cls: [band ? `b${band}` : '', r?.status === 'pending' ? 'pending' : '', r?.status === 'failed' ? 'failed' : '', r?.edited ? 'edited' : '', r?.ignored ? 'dim' : '']
          .filter(Boolean)
          .join(' '),
        badge: r?.edited ? { text: '✎ נערך', cls: '!border !border-accent !text-accent' } : showBadge ? { text: `${r.probability}%`, cls: `b${band}` } : undefined,
        label: band ? `משפט חשוד, ${r.probability}%, ${BAND_LABEL[band]}` : undefined,
      };
    },
    [analysis.results, visible, threshold, settings.alwaysShowPercent],
  );

  async function downloadDocx() {
    setDownloading(true);
    try {
      const original = await getFile(analysis.id);
      if (!original) return setDocxUnavailable(true);
      const blob = await buildEditedDocx(original, analysis.sentences);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (analysis.source?.fileName || 'document.docx').replace(/\.docx$/i, '') + ' (קולמוס).docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setDownloading(false);
    }
  }

  const select = useCallback((id: number | null) => {
    setSelected(id);
    if (id !== null) {
      const el = document.getElementById(`s-${id}`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    }
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!flaggedIds.length) return;
      const order = analysis.sentences.map((s) => s.id);
      const curPos = selected === null ? -1 : order.indexOf(selected);
      const candidates = dir === 1 ? flaggedIds.filter((id) => order.indexOf(id) > curPos) : flaggedIds.filter((id) => order.indexOf(id) < curPos).reverse();
      select(candidates[0] ?? (dir === 1 ? flaggedIds[0] : flaggedIds[flaggedIds.length - 1]));
    },
    [flaggedIds, selected, analysis.sentences, select],
  );

  const current = selected !== null ? analysis.sentences.find((s) => s.id === selected) : undefined;
  const currentResult = selected !== null ? analysis.results[selected] : undefined;

  async function rewriteParagraph(paragraph: number) {
    const text = paragraphs.find((p) => p[0].paragraph === paragraph)?.map((s) => s.text).join(' ') || '';
    setParaRewrite({ paragraph, loading: true });
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: settings.keys[settings.provider],
          model: settings.models[settings.provider],
          text,
          context: analysis.context,
          explanationLanguage: explanationLang(settings, text),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'unknown');
      setParaRewrite({ paragraph, loading: false, text: data.rewrite, changes: data.changes });
    } catch (e) {
      const code = errorCode(e instanceof Error ? e.message : '');
      setParaRewrite({ paragraph, loading: false, error: he.errors[code === 'missingKey' ? 'missingKey' : code === 'invalidKey' ? 'invalidKey' : code === 'rateLimit' ? 'rateLimit' : 'unknown'] });
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Escape') {
        setSelected(null);
        setFiltersOpen(false);
        setParaRewrite(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        props.onReanalyze();
        return;
      }
      if (t.closest('input, textarea, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'j') step(1);
      else if (e.key === 'k') step(-1);
      else if (e.key === '[') setThreshold((v) => Math.max(0, v - 5));
      else if (e.key === ']') setThreshold((v) => Math.min(95, v + 5));
      else if (/^[1-7]$/.test(e.key)) {
        const c = CATEGORIES[+e.key - 1];
        setEnabled((s) => {
          const n = new Set(s);
          if (n.has(c)) n.delete(c);
          else n.add(c);
          return n;
        });
      } else if (e.key === 'a' && currentResult?.rewrite && selected !== null) props.onApply(selected, currentResult.rewrite);
      else if (e.key === 'c' && currentResult?.rewrite) navigator.clipboard?.writeText(currentResult.rewrite);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, currentResult, selected, props]);

  const llmPending = running && !!progress;
  const failedChunks = progress?.chunks.filter((c) => c.status === 'failed') || [];
  const firstErr = failedChunks.find((c) => c.error)?.error;

  const inspector =
    current && currentResult ? (
      <Inspector
        key={current.id}
        sentence={current}
        result={currentResult}
        threshold={threshold}
        index={flaggedIds.indexOf(current.id)}
        total={flaggedIds.length}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onClose={() => setSelected(null)}
        onApply={(t) => props.onApply(current.id, t)}
        onIgnore={() => props.onToggleIgnore(current.id)}
        onRewriteParagraph={() => rewriteParagraph(current.paragraph)}
        decisionModel={analysis.meta.decisionModel}
      />
    ) : (
      <p className="text-[14px] text-muted">{he.empty.inspector}</p>
    );

  const summary = (
    <>
      <ScoreCard analysis={analysis} pending={llmPending} dirty={dirty} />
      {progress && running && <ProgressList progress={progress} onCancel={props.onCancel} />}
      <Filters
        analysis={analysis}
        threshold={threshold}
        setThreshold={setThreshold}
        enabled={enabled}
        toggle={(c) =>
          setEnabled((s) => {
            const n = new Set(s);
            if (n.has(c)) n.delete(c);
            else n.add(c);
            return n;
          })
        }
        flaggedCount={flaggedIds.length}
      />
      {patternFilter && (
        <button onClick={() => setPatternFilter(null)} className="card flex items-center justify-between p-3 text-[14px]">
          <span>
            מסונן לפי: <strong>{PATTERN_BY_ID[patternFilter]?.nameHe}</strong>
          </span>
          <IconX width={16} />
        </button>
      )}
      <TopPatterns analysis={analysis} onPick={(id) => setPatternFilter((p) => (p === id ? null : id))} />
      <Stats analysis={analysis} />
    </>
  );

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Mobile / tablet sticky score bar */}
      <div className="sticky top-14 z-20 flex h-13 items-center gap-3 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur lg:hidden">
        <ScoreRing value={analysis.overall.probability} size={36} stroke={4} />
        <div className="min-w-0 text-[14px] leading-tight">
          <div className="font-bold">
            {analysis.overall.probability}% · {CONFIDENCE_LABEL[analysis.overall.confidence]}
          </div>
          <div className="truncate text-[12px] text-muted">
            {running ? 'מנתח…' : he.results.sentencesFlagged.replace('{flagged}', String(flaggedIds.length)).replace('{total}', String(analysis.sentences.length))}
          </div>
        </div>
        <div className="ms-auto flex gap-1">
          <button onClick={() => setFiltersOpen(true)} aria-label={he.filters.title} className="grid size-10 place-items-center rounded-md border border-border">
            <IconFilter />
          </button>
          <button onClick={props.onReanalyze} disabled={running} aria-label="ניתוח מחדש" className="grid size-10 place-items-center rounded-md border border-border disabled:opacity-40">
            <IconRefresh />
          </button>
        </div>
      </div>

      <div className="grid gap-6 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:py-6">
        <aside className="hidden space-y-4 lg:block lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">{summary}</aside>

        <section className="min-w-0">
          <div className={`mx-auto ${showDocx ? 'max-w-[900px]' : 'max-w-[720px]'}`}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h1 dir="auto" className="me-auto text-[19px] font-bold md:text-[22px]">
                {analysis.title}
              </h1>
              <button onClick={props.onReanalyze} disabled={running} className="hidden min-h-10 items-center gap-1.5 rounded-md border border-border px-3 font-semibold disabled:opacity-40 lg:flex" title="Ctrl+Enter">
                <IconRefresh width={16} /> נתח מחדש
              </button>
              {isDocx && (
                <>
                  <button onClick={downloadDocx} disabled={downloading} className="flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3 font-semibold text-accent-fg disabled:opacity-50">
                    <IconDownload width={16} /> {downloading ? 'מכין…' : 'הורדת Word'}
                  </button>
                  <button onClick={() => setPreferText((v) => !v)} className="min-h-10 rounded-md border border-border px-3 text-[14px] font-semibold">
                    {preferText ? 'תצוגת Word' : 'תצוגת טקסט'}
                  </button>
                </>
              )}
              <button onClick={props.onNew} className="min-h-10 rounded-md px-3 font-semibold text-accent">
                {he.results.newAnalysis}
              </button>
            </div>

            {progress && running && (
              <div className="mb-4 lg:hidden">
                <ProgressList progress={progress} onCancel={props.onCancel} />
              </div>
            )}

            {!running && failedChunks.length > 0 && (
              <div className="card mb-4 border-s-4 !border-s-danger p-3 text-[14px]" role="alert">
                {he.errors[errorCode(firstErr)]} ({failedChunks.length} מקטעים נכשלו, מוצג ציון מקומי עבורם.)
                <button onClick={props.onReanalyze} className="ms-2 font-semibold text-accent underline">
                  {he.errors.retry}
                </button>
                {firstErr && (
                  <details className="mt-1 text-[12px] text-muted">
                    <summary>פרטים מהספק</summary>
                    <code dir="ltr" className="block break-all">{firstErr}</code>
                  </details>
                )}
              </div>
            )}

            {showDocx ? (
              <DocxView
                fileKey={analysis.id}
                sentences={analysis.sentences}
                decor={decor}
                selected={selected}
                onSelect={(id) => {
                  select(id);
                  setSheetFull(false);
                }}
                onUnavailable={() => setDocxUnavailable(true)}
              />
            ) : (
            <div ref={docRef} className="doc card p-5 md:p-8" role="document">
              {paragraphs.map((para) => (
                <p key={para[0].paragraph} dir="auto" className="mb-4 last:mb-0">
                  {para.map((s) => {
                    const r = analysis.results[s.id];
                    const shown = visible(r);
                    const band = shown ? bandOf(r.probability, threshold) : 0;
                    const showBadge = band >= 2 || (band === 1 && settings.alwaysShowPercent);
                    const cls = [
                      'sent',
                      band ? `b${band}` : '',
                      r?.status === 'pending' ? 'pending' : '',
                      r?.status === 'failed' ? 'failed' : '',
                      r?.edited ? 'edited' : '',
                      r?.ignored ? 'dim' : '',
                    ].join(' ');
                    return (
                      <span key={s.id}>
                        <span
                          id={`s-${s.id}`}
                          role="button"
                          tabIndex={selected === s.id ? 0 : -1}
                          aria-current={selected === s.id ? 'true' : undefined}
                          aria-label={band ? `משפט חשוד, ${r.probability}%, ${BAND_LABEL[band]}` : undefined}
                          className={cls}
                          onClick={() => {
                            select(s.id);
                            setSheetFull(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') select(s.id);
                          }}
                        >
                          {s.text}
                          {r?.edited && <span className="badge !border !border-accent !text-accent">✎ נערך</span>}
                          {showBadge && <span className={`badge b${band}`}>{r.probability}%</span>}
                        </span>{' '}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
            )}
            {flaggedIds.length === 0 && !running && <p className="mt-3 text-center text-[14px] text-muted">{he.results.noneFlagged}</p>}
            <p className="mt-6 text-[12px] text-muted">
              {he.disclaimer.body}
              {analysis.meta.model && (
                <span dir="ltr" className="ms-1 font-mono">
                  [{analysis.meta.model}
                  {analysis.meta.decisionModel ? ` + ${analysis.meta.decisionModel}` : ''} · {analysis.meta.heuristicsVersion}]
                </span>
              )}
            </p>
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="card sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto p-4">{inspector}</div>
        </aside>
      </div>

      {/* Mobile/tablet bottom sheet for sentence details */}
      {current && (
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
          <div className="absolute inset-0 -top-[100dvh] bg-black/20" onClick={() => setSelected(null)} aria-hidden />
          <div
            className={`sheet-up pb-safe relative overflow-y-auto rounded-t-2xl border-t border-border bg-surface px-4 pb-6 shadow-2xl ${sheetFull ? 'h-[90dvh]' : 'max-h-[55dvh]'}`}
            role="dialog"
            aria-label={he.inspector.title}
          >
            <button onClick={() => setSheetFull((v) => !v)} className="sticky top-0 z-10 flex w-full justify-center bg-surface py-2" aria-label="הרחבה">
              <span className="h-1.5 w-10 rounded-full bg-border" />
            </button>
            {inspector}
          </div>
        </div>
      )}

      {/* Mobile filters + summary sheet */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bg p-4 lg:hidden" role="dialog" aria-label={he.filters.title}>
          <div className="mb-3 flex items-center">
            <h2 className="text-[17px] font-bold">{he.results.title}</h2>
            <button onClick={() => setFiltersOpen(false)} className="ms-auto grid size-10 place-items-center" aria-label={he.inspector.close}>
              <IconX />
            </button>
          </div>
          <div className="space-y-4">{summary}</div>
        </div>
      )}

      {/* Paragraph rewrite dialog */}
      {paraRewrite && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={() => setParaRewrite(null)}>
          <div className="card max-h-[90dvh] w-full max-w-2xl overflow-y-auto !rounded-b-none p-5 md:!rounded-b-[10px]" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="mb-3 flex items-center">
              <h2 className="text-[17px] font-bold">{he.results.rewriteParagraph}</h2>
              <button onClick={() => setParaRewrite(null)} className="ms-auto grid size-10 place-items-center" aria-label={he.inspector.close}>
                <IconX />
              </button>
            </div>
            {paraRewrite.loading && <p className="text-muted">{he.progress.rewriting}</p>}
            {paraRewrite.error && <p className="text-danger">{paraRewrite.error}</p>}
            {paraRewrite.text && (
              <>
                <p dir="auto" className="doc rounded-md bg-surface-2 p-3 !text-[16px]">{paraRewrite.text}</p>
                {!!paraRewrite.changes?.length && (
                  <ul className="mt-3 list-disc space-y-1 ps-5 text-[14px] text-muted">
                    {paraRewrite.changes.map((c, i) => (
                      <li key={i} dir="auto">{c}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[12px] text-muted">{he.inspector.rewriteNote}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      props.onReplaceParagraph(paraRewrite.paragraph, paraRewrite.text!);
                      setParaRewrite(null);
                      setSelected(null);
                    }}
                    className="min-h-10 rounded-md bg-accent px-4 font-semibold text-accent-fg"
                  >
                    {he.inspector.apply}
                  </button>
                  <button onClick={() => navigator.clipboard?.writeText(paraRewrite.text!)} className="min-h-10 rounded-md border border-border px-4 font-semibold">
                    {he.inspector.copy}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
