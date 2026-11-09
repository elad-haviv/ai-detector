'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { computeStats, findHits, heuristicScore, overallScore } from '@/lib/heuristics';
import { applyRewrite, enrich, initialAnalysis, type Progress } from '@/lib/runAnalysis';
import { segment } from '@/lib/segment';
import { getFromHistory, hasKey, saveToHistory, useSettings } from '@/lib/store';
import type { Analysis } from '@/lib/types';
import { InputPanel } from './InputPanel';
import { ResultsView } from './results/ResultsView';

export function Workspace() {
  const [settings] = useSettings();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const params = useSearchParams();
  const router = useRouter();

  // Open an analysis from history (?id=)
  useEffect(() => {
    const id = params.get('id');
    if (id) {
      const a = getFromHistory(id);
      if (a) setAnalysis(a);
    }
  }, [params]);

  async function run(a: Analysis, onlyIds?: Set<number>) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAnalysis(a);
    setDirty(false);
    saveToHistory(a);
    if (!hasKey(settings)) return;
    setRunning(true);
    try {
      const final = await enrich(
        a,
        settings,
        (next, p) => {
          setAnalysis(next);
          setProgress(p);
        },
        ctrl.signal,
        onlyIds,
      );
      saveToHistory(final);
    } catch {
      // aborted
    } finally {
      if (abortRef.current === ctrl) setRunning(false);
    }
  }

  function start(text: string, title: string, context: string) {
    const a = initialAnalysis(text, title, context, settings);
    router.replace(`/?id=${a.id}`);
    run(a);
  }

  function reanalyze() {
    if (!analysis) return;
    const edited = new Set(Object.values(analysis.results).filter((r) => r.edited || r.status === 'failed').map((r) => r.id));
    const fresh = initialAnalysis('', analysis.title, analysis.context, settings);
    const base: Analysis = {
      ...analysis,
      meta: { ...fresh.meta },
      results: Object.fromEntries(
        Object.entries(analysis.results).map(([k, r]) => [
          k,
          !edited.size || edited.has(r.id) ? { ...r, edited: false, status: hasKey(settings) ? 'pending' : 'heuristic-only' } : r,
        ]),
      ) as Analysis['results'],
    };
    run(base, edited.size ? edited : undefined);
  }

  function update(next: Analysis) {
    setAnalysis(next);
    setDirty(true);
    saveToHistory(next);
  }

  function replaceParagraph(paragraph: number, text: string) {
    if (!analysis) return;
    let nextId = Math.max(...analysis.sentences.map((s) => s.id)) + 1;
    const newSents = segment(text).map((s) => ({ ...s, id: nextId++, paragraph }));
    const sentences = analysis.sentences.flatMap((s, i, arr) => {
      if (s.paragraph !== paragraph) return [s];
      return arr.findIndex((x) => x.paragraph === paragraph) === i ? newSents : [];
    });
    const results = { ...analysis.results };
    for (const s of analysis.sentences) if (s.paragraph === paragraph) delete results[s.id];
    for (const s of newSents) {
      const hits = findHits(s.text);
      const h = heuristicScore(hits);
      results[s.id] = { id: s.id, heuristic: h, probability: h, hits, patterns: hits.map((x) => x.patternId), status: 'heuristic-only', edited: true };
    }
    update({ ...analysis, sentences, results, overall: { ...overallScore(sentences, results), summary: analysis.overall.summary }, stats: computeStats(sentences) });
  }

  if (!analysis) return <InputPanel onAnalyze={start} />;

  return (
    <ResultsView
      analysis={analysis}
      progress={progress}
      running={running}
      dirty={dirty}
      onApply={(id, text) => update(applyRewrite(analysis, id, text))}
      onToggleIgnore={(id) => {
        const r = analysis.results[id];
        const results = { ...analysis.results, [id]: { ...r, ignored: !r.ignored } };
        const next = { ...analysis, results, overall: { ...overallScore(analysis.sentences, results), summary: analysis.overall.summary } };
        setAnalysis(next);
        saveToHistory(next);
      }}
      onReplaceParagraph={replaceParagraph}
      onReanalyze={reanalyze}
      onCancel={() => {
        abortRef.current?.abort();
        setRunning(false);
      }}
      onNew={() => {
        abortRef.current?.abort();
        setRunning(false);
        setAnalysis(null);
        setProgress(null);
        router.replace('/');
      }}
    />
  );
}
