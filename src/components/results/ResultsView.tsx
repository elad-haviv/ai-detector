'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PATTERN_BY_ID, sensitivityThreshold } from '@/lib/heuristics';
import { he } from '@/lib/i18n/he';
import type { PatternCategory } from '@/lib/patterns/catalog';
import { errorCode, explanationLang, type Progress } from '@/lib/runAnalysis';
import { groupParagraphs } from '@/lib/segment';
import { getKey } from '@/lib/keyStore';
import { useSettings } from '@/lib/store';
import type { Analysis, SentenceResult } from '@/lib/types';
import { getFile } from '@/lib/blobStore';
import { buildEditedDocx } from '@/lib/docx/model';
import { IconChevron, IconDownload, IconFilter, IconRefresh, IconX } from '../icons';
import { Button, Dialog, useToast } from '../ui';
import { DocxView, type Decor } from './DocxView';
import { Inspector } from './Inspector';
import { CATEGORIES, Filters, ProgressList, ScoreCard, Stats, TopPatterns } from './SummaryPanel';
import { BAND_LABEL, BandLegend, CONFIDENCE_LABEL, ScoreRing, bandOf } from './shared';

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
  // Last selected sentence: keeps the document's roving tab stop (and Esc's focus target) after closing.
  const [lastSelected, setLastSelected] = useState<number | null>(null);
  const toast = useToast();
  /** Where to put focus once the new selection has rendered (see `select`). */
  const pendingFocus = useRef<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
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
        cls: [band ? `b${band}` : '', !band && r?.hits.length && !r.ignored ? 'hint' : '', r?.status === 'pending' ? 'pending' : '', r?.status === 'failed' ? 'failed' : '', r?.edited ? 'edited' : '', r?.ignored ? 'dim' : '']
          .filter(Boolean)
          .join(' '),
        badge: r?.edited ? { text: '✎ נערך', cls: '!border !border-accent !text-accent' } : showBadge ? { text: `${r.probability}%`, cls: `b${band}` } : undefined,
        label: band ? he.results.sentenceLabelDocx.replace('{band}', BAND_LABEL[band]).replace('{percent}', String(r.probability)) : undefined,
      };
    },
    [analysis.results, visible, threshold, settings.alwaysShowPercent],
  );

  // A descriptive tab title while a result is open (restored when leaving the results view).
  useEffect(() => {
    const before = document.title;
    document.title = he.results.pageTitle.replace('{title}', analysis.title);
    return () => {
      document.title = before;
    };
  }, [analysis.title]);

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

  /**
   * Select a sentence. Focus rules (keyboard users never lose their place):
   * - from the document or the j/k keys: focus the sentence (desktop) / move into the details sheet (mobile);
   * - from the toolbar's prev/next: focus stays on that button (desktop) / moves into the sheet (mobile);
   * - from the inspector's own prev/next: focus returns to the same button after it re-renders.
   */
  const select = useCallback((id: number | null, source: 'doc' | 'toolbar' | 'next' | 'prev' = 'doc') => {
    setSelected(id);
    if (id === null) return;
    setLastSelected(id);
    const el = document.getElementById(`s-${id}`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    const mobile = window.matchMedia('(max-width: 1023.98px)').matches;
    if (source === 'next' || source === 'prev') pendingFocus.current = `[data-nav="${source}"]`;
    else if (mobile) pendingFocus.current = 'sheet';
    else if (source === 'doc') el?.focus({ preventScroll: true });
  }, []);

  // Apply the focus request from `select` once the inspector/sheet for the new sentence exists.
  useEffect(() => {
    const want = pendingFocus.current;
    if (!want || selected === null) return;
    pendingFocus.current = null;
    const mobile = window.matchMedia('(max-width: 1023.98px)').matches;
    const scope = mobile ? sheetRef.current : document.querySelector<HTMLElement>('[data-inspector="desktop"]');
    const target = want === 'sheet' ? sheetRef.current : scope?.querySelector<HTMLElement>(want);
    target?.focus({ preventScroll: true });
  }, [selected]);

  /** Close the details (Esc, close button, backdrop) and return focus to the sentence. */
  const closeDetails = useCallback(() => {
    setSelected((id) => {
      if (id !== null) requestAnimationFrame(() => document.getElementById(`s-${id}`)?.focus({ preventScroll: true }));
      return null;
    });
  }, []);

  const step = useCallback(
    (dir: 1 | -1, source: 'doc' | 'toolbar' | 'next' | 'prev' = 'doc') => {
      if (!flaggedIds.length) return;
      const order = analysis.sentences.map((s) => s.id);
      // continue from the last selected sentence even after the details were closed
      const from = selected ?? lastSelected;
      const curPos = from === null ? -1 : order.indexOf(from);
      const candidates = dir === 1 ? flaggedIds.filter((id) => order.indexOf(id) > curPos) : flaggedIds.filter((id) => order.indexOf(id) < curPos).reverse();
      select(candidates[0] ?? (dir === 1 ? flaggedIds[0] : flaggedIds[flaggedIds.length - 1]), source);
    },
    [flaggedIds, selected, lastSelected, analysis.sentences, select],
  );

  const current = selected !== null ? analysis.sentences.find((s) => s.id === selected) : undefined;
  const currentResult = selected !== null ? analysis.results[selected] : undefined;
  // Roving tab stop in the document: the selected sentence, else the first suspicious one, else the first.
  const tabStop = selected ?? (lastSelected !== null && analysis.results[lastSelected] ? lastSelected : undefined) ?? flaggedIds[0] ?? analysis.sentences[0]?.id;
  const position = selected !== null ? flaggedIds.indexOf(selected) : -1;
  const announcement =
    current && currentResult && position >= 0
      ? he.results.announceSentence
          .replace('{index}', String(position + 1))
          .replace('{total}', String(flaggedIds.length))
          .replace('{percent}', String(currentResult.probability))
          .replace('{band}', BAND_LABEL[bandOf(currentResult.probability, threshold)])
      : '';

  async function rewriteParagraph(paragraph: number) {
    const text = paragraphs.find((p) => p[0].paragraph === paragraph)?.map((s) => s.text).join(' ') || '';
    setParaRewrite({ paragraph, loading: true });
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: getKey(settings.provider),
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
        if (document.querySelector('dialog[open]')) return; // the dialog handles its own Esc
        if (selected !== null) closeDetails();
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
      } else if (e.key === 'a' && currentResult?.rewrite && selected !== null) {
        props.onApply(selected, currentResult.rewrite);
        toast(he.inspector.appliedToast, { tone: 'success' });
      }
      else if (e.key === 'c' && currentResult?.rewrite)
        navigator.clipboard?.writeText(currentResult.rewrite).then(
          () => toast(he.inspector.copiedToast, { tone: 'success' }),
          () => toast(he.inspector.copyFailed, { tone: 'danger' }),
        );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, currentResult, selected, props, closeDetails, toast]);

  const llmPending = running && !!progress;
  const failedChunks = progress?.chunks.filter((c) => c.status === 'failed') || [];
  const firstErr = failedChunks.find((c) => c.error)?.error;

  const inspector = (headingId: string) =>
    current && currentResult ? (
      <Inspector
        headingId={headingId}
        key={current.id}
        sentence={current}
        result={currentResult}
        threshold={threshold}
        index={flaggedIds.indexOf(current.id)}
        total={flaggedIds.length}
        onPrev={() => step(-1, 'prev')}
        onNext={() => step(1, 'next')}
        onClose={closeDetails}
        onApply={(t) => props.onApply(current.id, t)}
        onIgnore={() => props.onToggleIgnore(current.id)}
        onRewriteParagraph={() => rewriteParagraph(current.paragraph)}
        decisionModel={analysis.meta.decisionModel}
      />
    ) : (
      <p className="text-sm text-muted">{he.empty.inspector}</p>
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
        <button type="button" onClick={() => setPatternFilter(null)} className="card flex min-h-11 items-center justify-between p-3 text-sm">
          <span>
            מסונן לפי: <strong>{PATTERN_BY_ID[patternFilter]?.nameHe}</strong>
          </span>
          <IconX width={16} />
        </button>
      )}
      <TopPatterns analysis={analysis} active={patternFilter} onPick={(id) => setPatternFilter((p) => (p === id ? null : id))} />
      <Stats analysis={analysis} />
    </>
  );

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Mobile / tablet sticky score bar */}
      <div className="unstick-short sticky top-14 z-20 flex min-h-14 items-center gap-3 border-b border-border bg-bg/95 px-4 py-1.5 backdrop-blur lg:hidden">
        <ScoreRing value={analysis.overall.probability} size={36} stroke={4} />
        <div className="min-w-0 text-sm leading-tight">
          <div className="font-bold">
            {analysis.overall.basis === 'local' ? 'ניתוח מקומי בלבד' : `${analysis.overall.probability}% · ${CONFIDENCE_LABEL[analysis.overall.confidence]}`}
            {analysis.overall.basis === 'model' && (analysis.overall.coverage ?? 1) < 0.98 && ` · נותחו ${Math.round((analysis.overall.coverage ?? 0) * 100)}%`}
          </div>
          <div className="truncate text-xs text-muted">
            {running ? 'מנתח…' : he.results.sentencesFlagged.replace('{flagged}', String(flaggedIds.length)).replace('{total}', String(analysis.sentences.length))}
          </div>
        </div>
        <div className="ms-auto flex gap-1">
          <Button iconOnly onClick={() => setFiltersOpen(true)} aria-label={he.results.openSummary} aria-haspopup="dialog">
            <IconFilter />
          </Button>
          <Button iconOnly onClick={props.onReanalyze} disabled={running} aria-label={he.results.reanalyze}>
            <IconRefresh />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:py-6">
        <aside aria-label={he.results.summaryTitle} className="hidden space-y-4 lg:block lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
          {summary}
        </aside>

        <section className="min-w-0" aria-labelledby="doc-title">
          <div className={`mx-auto ${showDocx ? 'max-w-[900px]' : 'max-w-[720px]'}`}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h1 id="doc-title" dir="auto" className="me-auto min-w-0 text-[1.1875rem] font-bold md:text-title">
                {analysis.title}
              </h1>
              <Button size="sm" onClick={props.onReanalyze} disabled={running} icon={<IconRefresh width={16} height={16} />} className="hidden lg:inline-flex" title="Ctrl+Enter">
                {he.results.reanalyze}
              </Button>
              {isDocx && (
                <>
                  <Button size="sm" variant="primary" onClick={downloadDocx} disabled={downloading} icon={<IconDownload width={16} height={16} />}>
                    {downloading ? he.results.preparing : he.results.downloadWord}
                  </Button>
                  <Button size="sm" onClick={() => setPreferText((v) => !v)}>
                    {preferText ? he.results.wordView : he.results.textView}
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={props.onNew} className="text-accent">
                {he.results.newAnalysis}
              </Button>
            </div>

            {/* Always-visible legend + keyboard-friendly navigation between suspicious sentences */}
            <div className="unstick-short sticky top-28 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface/95 px-3 py-2 backdrop-blur lg:top-16">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">{he.results.legendTitle}:</span>
                <BandLegend />
              </div>
              <div role="group" aria-label={he.results.sentenceNav} className="ms-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => step(-1, 'toolbar')} disabled={!flaggedIds.length} title={`${he.results.prevSuspicious} (k)`} icon={<IconChevron dir="prev" width={18} height={18} />}>
                  <span className="sr-only sm:not-sr-only">{he.results.prevSuspicious}</span>
                </Button>
                <span className="min-w-16 text-center text-caption tabular-nums text-muted">
                  {position >= 0
                    ? he.results.position.replace('{index}', String(position + 1)).replace('{total}', String(flaggedIds.length))
                    : he.results.noneSelected.replace('{total}', String(flaggedIds.length))}
                </span>
                <Button size="sm" variant="ghost" onClick={() => step(1, 'toolbar')} disabled={!flaggedIds.length} title={`${he.results.nextSuspicious} (j)`}>
                  <span className="sr-only sm:not-sr-only">{he.results.nextSuspicious}</span>
                  <IconChevron dir="next" width={18} height={18} />
                </Button>
              </div>
            </div>
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>

            {progress && running && (
              <div className="mb-4 lg:hidden">
                <ProgressList progress={progress} onCancel={props.onCancel} />
              </div>
            )}

            {!running && failedChunks.length > 0 && (
              <div className="mb-4 rounded-lg border border-border border-s-4 border-s-danger bg-surface p-3 text-sm" role="alert">
                {he.errors[errorCode(firstErr)]} ({failedChunks.length} מקטעים נכשלו, מוצג ציון מקומי עבורם.)
                <button type="button" onClick={props.onReanalyze} className="ms-2 min-h-9 font-semibold text-accent underline">
                  {he.errors.retry}
                </button>
                {firstErr && (
                  <details className="mt-1 text-xs text-muted">
                    <summary className="flex min-h-9 cursor-pointer items-center">פרטים מהספק</summary>
                    <code dir="ltr" lang="en" className="block break-all">{firstErr}</code>
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
            <div ref={docRef} className="doc card p-5 md:p-8" role="document" aria-label={he.results.document}>
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
                      !band && r?.hits.length && !r.ignored ? 'hint' : '',
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
                          tabIndex={tabStop === s.id ? 0 : -1}
                          aria-current={selected === s.id ? 'true' : undefined}
                          className={cls}
                          onClick={() => {
                            select(s.id);
                            setSheetFull(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              select(s.id);
                            }
                          }}
                        >
                          {s.text}
                          {band > 0 && (
                            <span className="sr-only">
                              {(showBadge ? he.results.sentenceSuffix : he.results.sentenceSuffixPercent).replace('{band}', BAND_LABEL[band]).replace('{percent}', String(r.probability))}
                            </span>
                          )}
                          {r?.edited && (
                            <span className="badge !border !border-accent !text-accent">
                              <span aria-hidden>✎ </span>
                              {he.results.edited}
                            </span>
                          )}
                          {showBadge && <span className={`badge b${band}`}>{r.probability}%</span>}
                        </span>{' '}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
            )}
            {flaggedIds.length === 0 && !running && <p className="mt-3 text-center text-sm text-muted">{he.results.noneFlagged}</p>}
            <p className="mt-6 text-xs text-muted">
              {he.disclaimer.body}
              {analysis.meta.model && (
                <span dir="ltr" lang="en" className="ms-1 font-mono">
                  [{analysis.meta.model}
                  {analysis.meta.decisionModel ? ` + ${analysis.meta.decisionModel}` : ''} · {analysis.meta.heuristicsVersion}]
                </span>
              )}
            </p>
          </div>
        </section>

        <aside aria-label={he.inspector.title} className="hidden lg:block" data-inspector="desktop">
          <div className="card sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto p-4">{inspector('insp-desktop-title')}</div>
        </aside>
      </div>

      {/* Mobile/tablet bottom sheet for sentence details */}
      {/* Non-modal on purpose: the document stays usable (tap another sentence, j/k). Focus moves into
          the sheet when it opens, Esc or the close button returns it to the sentence. */}
      {current && (
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
          <div className="absolute inset-0 -top-[100dvh] bg-black/20" onClick={closeDetails} aria-hidden />
          <div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="false"
            aria-labelledby="insp-sheet-title"
            className={`sheet-up pb-safe relative overflow-y-auto rounded-t-2xl border-t border-border bg-surface px-4 pb-6 shadow-2xl focus:outline-none ${sheetFull ? 'h-[90dvh]' : 'max-h-[55dvh]'}`}
          >
            <button
              type="button"
              onClick={() => setSheetFull((v) => !v)}
              aria-expanded={sheetFull}
              className="focus-ring-inset sticky top-0 z-10 flex min-h-11 w-full items-center justify-center bg-surface"
              aria-label={he.results.sheetExpand}
            >
              <span aria-hidden className="h-1.5 w-10 rounded-full bg-border-strong" />
            </button>
            {inspector('insp-sheet-title')}
          </div>
        </div>
      )}

      {/* Mobile filters + summary sheet */}
      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title={he.results.summaryTitle} variant="full" className="lg:hidden">
        <div className="space-y-4">{summary}</div>
      </Dialog>

      {/* Paragraph rewrite dialog */}
      <Dialog
        open={!!paraRewrite}
        onClose={() => setParaRewrite(null)}
        title={he.results.rewriteParagraph}
        variant="sheet"
        footer={
          paraRewrite?.text ? (
            <>
              <Button
                onClick={() =>
                  navigator.clipboard?.writeText(paraRewrite.text!).then(
                    () => toast(he.inspector.copiedToast, { tone: 'success' }),
                    () => toast(he.inspector.copyFailed, { tone: 'danger' }),
                  )
                }
              >
                {he.inspector.copy}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  props.onReplaceParagraph(paraRewrite.paragraph, paraRewrite.text!);
                  setParaRewrite(null);
                  setSelected(null);
                  toast(he.inspector.appliedToast, { tone: 'success' });
                }}
              >
                {he.inspector.apply}
              </Button>
            </>
          ) : undefined
        }
      >
        <div aria-live="polite" aria-busy={paraRewrite?.loading}>
          {paraRewrite?.loading && <p className="text-muted">{he.progress.rewriting}</p>}
          {paraRewrite?.error && <p className="font-semibold text-danger">{paraRewrite.error}</p>}
          {paraRewrite?.text && (
            <>
              <p dir="auto" className="doc rounded-md bg-surface-2 p-3 !text-base">
                {paraRewrite.text}
              </p>
              {!!paraRewrite.changes?.length && (
                <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted">
                  {paraRewrite.changes.map((c, i) => (
                    <li key={i} dir="auto">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">{he.inspector.rewriteNote}</p>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
