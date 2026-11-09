'use client';
import { useEffect, useRef, useState } from 'react';
import { he } from '@/lib/i18n/he';
import { countWords } from '@/lib/segment';
import { useKeys } from '@/lib/keyStore';
import { llmMode, useSettings } from '@/lib/store';
import { useAccount } from '@/lib/account';
import { OnboardingChooser } from './OnboardingChooser';
import { readBlocks } from '@/lib/docx/model';
import { IconFile, IconUpload } from './icons';
import { Button, Field, Input, Textarea, useToast } from './ui';

const MIN_WORDS = 25;
const MAX_WORDS = 20000;

const SAMPLE = `בעולם המשתנה של ימינו, הבינה המלאכותית ממלאת תפקיד מרכזי בעיצוב פני החינוך. חשוב לציין כי השימוש בכלים אלו מהווה לא רק הזדמנות, אלא גם אתגר משמעותי עבור מורים, תלמידים ומקבלי החלטות. יתרה מכך, מחקרים רבים מראים כי שילוב טכנולוגיה בכיתה מעשיר את חוויית הלמידה, מעודד חשיבה ביקורתית ומטפח יצירתיות.

בסמינר של פרופ' לוי ראיינתי שבעה מורים מבתי ספר בדרום. ארבעה מהם אמרו שהם כבר לא מבקשים עבודות בית כתובות. אחת המורות סיפרה שהיא חזרה למבחנים בכתב יד, "כמו בשנות התשעים". לא ציפיתי לזה.

לסיכום, ניתן לומר כי הבינה המלאכותית היא חרב פיפיות: מחד גיסא היא פותחת אופקים חדשים, ומאידך גיסא היא מציבה דילמות אתיות מורכבות. רק באמצעות גישה הוליסטית ומאוזנת נוכל לממש את הפוטנציאל הגלום בה ולהבטיח עתיד טוב יותר לכולנו.`;

export function InputPanel({
  onAnalyze,
  onAnalyzeDocx,
}: {
  onAnalyze: (text: string, title: string, context: string) => void;
  onAnalyzeDocx: (bytes: ArrayBuffer, fileName: string, title: string, context: string) => void;
}) {
  const [docx, setDocx] = useState<{ bytes: ArrayBuffer; name: string; text: string } | null>(null);
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
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        setDocx(null);
        setText(await file.text());
        setTitle(file.name.replace(/\.[^.]+$/, ''));
        toast(he.input.fileLoaded.replace('{name}', file.name), { tone: 'success' });
        return;
      }
      if (lower.endsWith('.docx')) {
        const bytes = await file.arrayBuffer();
        const blocks = await readBlocks(bytes);
        const t = blocks.map((b) => b.text.trim()).join('\n\n');
        if (!t.trim()) {
          setError(he.errors.invalidFile);
          return;
        }
        setText(t);
        setTitle(file.name.replace(/\.[^.]+$/, ''));
        setDocx({ bytes, name: file.name, text: t });
        toast(he.input.fileLoaded.replace('{name}', file.name), { tone: 'success' });
        return;
      }
      setDocx(null);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === 'scanned_pdf' ? he.errors.scannedPdf : he.errors.invalidFile);
        return;
      }
      setText(data.text);
      setTitle(data.title);
      toast(he.input.fileLoaded.replace('{name}', file.name), { tone: 'success' });
    } catch {
      setError(he.errors.network);
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
  const fmt = (n: number) => n.toLocaleString('he-IL');
  const textError = tooLong ? he.errors.tooLong.replace('{max}', fmt(MAX_WORDS)) : undefined;
  const analyze = () => {
    if (!canAnalyze) return;
    if (docx && docx.text === text) onAnalyzeDocx(docx.bytes, docx.name, title, context);
    else onAnalyze(text, title, context);
  };

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-6 md:py-10">
      <h1 className="text-title font-bold">{he.input.title}</h1>
      <p className="mt-1 text-muted">{he.tagline}</p>

      <ol aria-label={he.input.stepsTitle} className="mt-4 hidden gap-2 text-sm sm:grid sm:grid-cols-3">
        {[he.input.step1, he.input.step2, he.input.step3].map((t, i) => (
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
              {he.input.dropTitle} <span className="font-normal text-muted">{he.input.dropOr}</span>
            </p>
            <p className="text-caption text-muted">{he.input.supportedFormats}</p>
          </div>
          <Button onClick={() => fileRef.current?.click()} disabled={busy} icon={<IconUpload />} className="w-full md:w-auto">
            {busy ? he.progress.reading : he.input.uploadButton}
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

        <Field label={he.input.titleLabel} hint={he.input.titleHint}>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} dir={title ? 'auto' : 'rtl'} className="font-semibold" />}
        </Field>

        <Field
          label={he.input.textLabel}
          hint={he.input.textHint.replace('{min}', String(MIN_WORDS)).replace('{max}', fmt(MAX_WORDS))}
          error={textError}
          labelAside={
            <span className="text-caption tabular-nums text-muted">
              {he.input.wordCount.replace('{count}', fmt(words))} · {he.input.charCount.replace('{count}', fmt(chars))}
            </span>
          }
        >
          {(p) => (
            <Textarea
              {...p}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={he.input.placeholder}
              dir={text ? 'auto' : 'rtl'}
              rows={12}
              className="doc !text-h2"
            />
          )}
        </Field>

        {!text && (
          <p className="text-sm text-muted">
            {he.empty.input}{' '}
            <button type="button" onClick={() => setText(SAMPLE)} className="min-h-11 font-semibold text-accent underline underline-offset-4 hover:no-underline">
              {he.input.sampleButton}
            </button>
          </p>
        )}

        <details className="group rounded-lg border border-border px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{he.input.contextLabel}</summary>
          <div className="pb-3">
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={he.input.contextPlaceholder}
              aria-label={he.input.contextLabel}
              rows={2}
              dir={context ? 'auto' : 'rtl'}
              className="text-sm"
            />
          </div>
        </details>

        {docx && (
          <p className={`rounded-md px-3 py-2 text-caption ${docx.text === text ? 'bg-accent-soft' : 'bg-surface-2 text-muted'}`}>
            {docx.text === text ? he.input.docxKept.replace('{name}', docx.name) : he.input.docxChanged}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="submit" variant="primary" size="lg" disabled={!canAnalyze} aria-describedby={!canAnalyze && tooShort ? 'need-more' : undefined} className="w-full sm:w-auto">
            {he.input.analyzeButton}
          </Button>
          {text && (
            <Button
              variant="ghost"
              onClick={() => {
                setText('');
                setTitle('');
                setDocx(null);
              }}
            >
              {he.input.clearButton}
            </Button>
          )}
          {tooShort && (
            <p id="need-more" className="text-sm text-muted">
              {he.input.needMoreWords.replace('{count}', String(MIN_WORDS - words))}
            </p>
          )}
        </div>
      </form>

      <p className="mt-6 text-caption leading-relaxed text-muted">
        <strong>{he.disclaimer.title}:</strong> {he.disclaimer.body}
      </p>

      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm" aria-hidden>
          <div className="rounded-2xl border-2 border-dashed border-accent px-10 py-8 text-xl font-bold text-accent">{he.input.dropRelease}</div>
        </div>
      )}
    </div>
  );
}
