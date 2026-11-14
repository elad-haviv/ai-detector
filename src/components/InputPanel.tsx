'use client';
import { useEffect, useRef, useState } from 'react';
import { dirOf, intlLocale } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/client';
import { countWords } from '@/lib/segment';
import { useKeys } from '@/lib/keyStore';
import { llmMode, useSettings } from '@/lib/store';
import { useAccount } from '@/lib/account';
import { OnboardingChooser } from './OnboardingChooser';
import { readBlocks } from '@/lib/docx/model';
import { inspectDocx } from '@/lib/forensics/docx';
import type { FileForensics } from '@/lib/forensics/types';
import { IconFile, IconUpload } from './icons';
import { Button, Field, Input, Textarea, useToast } from './ui';

const MIN_WORDS = 25;
const MAX_WORDS = 20000;


export function InputPanel({
  onAnalyze,
  onAnalyzeDocx,
}: {
  onAnalyze: (text: string, title: string, context: string, file?: FileForensics) => void;
  onAnalyzeDocx: (bytes: ArrayBuffer, fileName: string, title: string, context: string, file?: FileForensics) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const uiDir = dirOf(locale);
  const [docx, setDocx] = useState<{ bytes: ArrayBuffer; name: string; text: string } | null>(null);
  /** Forensics of the uploaded Word/PDF file; kept until the text is cleared or another file is loaded. */
  const [fileInfo, setFileInfo] = useState<FileForensics | null>(null);
  const [settings] = useSettings();
  const { keys } = useKeys();
  const account = useAccount();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const words = countWords(text);
  const chars = text.length;
  const toast = useToast();

  async function loadFile(file: File) {
    setError(null);
    setBusy(true);
    setFileInfo(null);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        setDocx(null);
        setText(await file.text());
        setTitle(file.name.replace(/\.[^.]+$/, ''));
        toast(t.input.fileLoaded.replace('{name}', file.name), { tone: 'success' });
        return;
      }
      if (lower.endsWith('.docx')) {
        const bytes = await file.arrayBuffer();
        const blocks = await readBlocks(bytes);
        const extracted = blocks.map((b) => b.text.trim()).join('\n\n');
        if (!extracted.trim()) {
          setError(t.errors.invalidFile);
          return;
        }
        setText(extracted);
        setTitle(file.name.replace(/\.[^.]+$/, ''));
        setDocx({ bytes, name: file.name, text: extracted });
        // a file whose properties cannot be read is still analyzed as text
        setFileInfo(await inspectDocx(bytes, file.name).catch(() => null));
        toast(t.input.fileLoaded.replace('{name}', file.name), { tone: 'success' });
        return;
      }
      setDocx(null);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === 'scanned_pdf' ? t.errors.scannedPdf : t.errors.invalidFile);
        return;
      }
      setText(data.text);
      setTitle(data.title);
      setFileInfo(data.file ?? null);
      toast(t.input.fileLoaded.replace('{name}', file.name), { tone: 'success' });
    } catch {
      setError(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  const loadFileRef = useRef(loadFile);
  useEffect(() => {
    loadFileRef.current = loadFile;
  });

  // Window-wide drag & drop (desktop)
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) loadFileRef.current(f);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const tooShort = words > 0 && words < MIN_WORDS;
  const tooLong = words > MAX_WORDS;
  const canAnalyze = words >= MIN_WORDS && !tooLong && !busy;
  const num = (n: number) => n.toLocaleString(intlLocale(locale));
  const textError = tooLong ? t.errors.tooLong.replace('{max}', num(MAX_WORDS)) : undefined;
  const analyze = () => {
    if (!canAnalyze) return;
    const file = fileInfo ?? undefined;
    if (docx && docx.text === text) onAnalyzeDocx(docx.bytes, docx.name, title, context, file);
    else onAnalyze(text, title, context, file);
  };

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-6 md:py-10">
      <h1 className="text-title font-bold">{t.input.title}</h1>
      <p className="mt-1 text-muted">{t.tagline}</p>

      <ol aria-label={t.input.stepsTitle} className="mt-4 hidden gap-2 text-sm sm:grid sm:grid-cols-3">
        {[t.input.step1, t.input.step2, t.input.step3].map((t, i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>

      {mounted && account.loaded && !llmMode(settings, keys, account) && <OnboardingChooser />}

      <form
        className="card mt-4 space-y-4 p-4 md:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          analyze();
        }}
      >
        {/* File: button everywhere, drop target on desktop (the whole window also accepts drops) */}
        <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-surface-2/60 px-4 py-5 text-center md:flex-row md:text-start">
          <IconFile aria-hidden className="hidden size-8 shrink-0 text-muted md:block" />
          <div className="min-w-0 flex-1">
            <p className="hidden font-semibold md:block">
              {t.input.dropTitle} <span className="font-normal text-muted">{t.input.dropOr}</span>
            </p>
            <p className="text-caption text-muted">{t.input.supportedFormats}</p>
          </div>
          <Button onClick={() => fileRef.current?.click()} disabled={busy} icon={<IconUpload />} className="w-full md:w-auto">
            {busy ? t.progress.reading : t.input.uploadButton}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.docx,.pdf"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {error && (
          <p className="text-sm font-semibold text-danger" role="alert">
            {error}
          </p>
        )}

        <Field label={t.input.titleLabel} hint={t.input.titleHint}>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} dir={title ? 'auto' : uiDir} className="font-semibold" />}
        </Field>

        <Field
          label={t.input.textLabel}
          hint={t.input.textHint.replace('{min}', String(MIN_WORDS)).replace('{max}', num(MAX_WORDS))}
          error={textError}
          labelAside={
            <span className="text-caption tabular-nums text-muted">
              {t.input.wordCount.replace('{count}', num(words))} · {t.input.charCount.replace('{count}', num(chars))}
            </span>
          }
        >
          {(p) => (
            <Textarea
              {...p}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (!e.target.value.trim()) setFileInfo(null);
              }}
              placeholder={t.input.placeholder}
              dir={text ? 'auto' : uiDir}
              rows={12}
              className="doc !text-h2"
            />
          )}
        </Field>

        {!text && (
          <p className="text-sm text-muted">
            {t.empty.input}{' '}
            <button type="button" onClick={() => setText(t.input.sampleText)} className="min-h-11 font-semibold text-accent underline underline-offset-4 hover:no-underline">
              {t.input.sampleButton}
            </button>
          </p>
        )}

        <details className="group rounded-lg border border-border px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{t.input.contextLabel}</summary>
          <div className="pb-3">
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={t.input.contextPlaceholder}
              aria-label={t.input.contextLabel}
              rows={2}
              dir={context ? 'auto' : uiDir}
              className="text-sm"
            />
          </div>
        </details>

        {docx && (
          <p className={`rounded-md px-3 py-2 text-caption ${docx.text === text ? 'bg-accent-soft' : 'bg-surface-2 text-muted'}`}>
            {docx.text === text ? t.input.docxKept.replace('{name}', docx.name) : t.input.docxChanged}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="submit" variant="primary" size="lg" disabled={!canAnalyze} aria-describedby={!canAnalyze && tooShort ? 'need-more' : undefined} className="w-full sm:w-auto">
            {t.input.analyzeButton}
          </Button>
          {text && (
            <Button
              variant="ghost"
              onClick={() => {
                setText('');
                setTitle('');
                setDocx(null);
                setFileInfo(null);
              }}
            >
              {t.input.clearButton}
            </Button>
          )}
          {tooShort && (
            <p id="need-more" className="text-sm text-muted">
              {t.input.needMoreWords.replace('{count}', String(MIN_WORDS - words))}
            </p>
          )}
        </div>
      </form>

      <p className="mt-6 text-caption leading-relaxed text-muted">
        <strong>{t.disclaimer.title}:</strong> {t.disclaimer.body}
      </p>

      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm" aria-hidden>
          <div className="rounded-2xl border-2 border-dashed border-accent px-10 py-8 text-xl font-bold text-accent">{t.input.dropRelease}</div>
        </div>
      )}
    </div>
  );
}
