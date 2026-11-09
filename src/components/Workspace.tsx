'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { computeStats, findHits, heuristicScore, overallScore } from '@/lib/heuristics';
import { applyRewrite, enrich, initialAnalysis, type Progress } from '@/lib/runAnalysis';
import { segment } from '@/lib/segment';
import { putFile } from '@/lib/blobStore';
import { readBlocks, sentencesFromBlocks } from '@/lib/docx/model';
import { getFromHistory, getSettings, hasKey, saveToHistory, useSettings } from '@/lib/store';
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
  const currentIdRef = useRef<string | null>(null);
  // stop in-flight requests when leaving the page; saved progress lets the next visit resume
  useEffect(() => () => abortRef.current?.abort(), []);
  const params = useSearchParams();
  const router = useRouter();

  // Open an analysis from history (?id=)
  useEffect(() => {
    const id = params.get('id');
    if (id) {
      if (currentIdRef.current === id) return; // already showing it (e.g. right after starting)
      const a = getFromHistory(id);
      if (a) {
        currentIdRef.current = id;
        setAnalysis(a);
        // An analysis interrupted by a reload/navigation still has pending sentences: resume them.
        const pending = new Set(Object.values(a.results).filter((r) => r.status === 'pending').map((r) => r.id));
        if (pending.size && hasKey(getSettings())) run(a, pending);
      }
    }
  }, [params]);

  async function run(a: Analysis, onlyIds?: Set<number>) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    currentIdRef.current = a.id;
    setAnalysis(a);
    setDirty(false);
    saveToHistory(a);
    const settings = getSettings();
    if (!hasKey(settings)) return;
    setRunning(true);
    try {
      const final = await enrich(
        a,
        settings,
        (next, p) => {
          setAnalysis(next);
          setProgress(p);
          // persist after every finished chunk so an interrupted run can resume where it stopped
          if (p.chunks.some((c) => c.status === 'done' || c.status === 'failed')) saveToHistory(next);
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

  async function startDocx(bytes: ArrayBuffer, fileName: string, title: string, context: string) {
    const sentences = sentencesFromBlocks(await readBlocks(bytes));
    const a = initialAnalysis('', title || fileName.replace(/\.docx$/i, ''), context, settings, { sentences, source: { kind: 'docx', fileName } });
    await putFile(a.id, bytes);
    router.replace(`/?id=${a.id}`);
    run(a);
  }

  function reanalyze() {
    if (!analysis) return;
    const edited = new Set(Object.values(analysis.results).filter((r) => r.edited || r.status === 'failed' || r.status === 'pending').map((r) => r.id));
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

  if (!analysis) return <InputPanel onAnalyze={start} onAnalyzeDocx={startDocx} />;

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
        currentIdRef.current = null;
        router.replace('/');
      }}
    />
  );
}
