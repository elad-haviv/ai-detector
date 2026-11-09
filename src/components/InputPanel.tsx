'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { he } from '@/lib/i18n/he';
import { countWords } from '@/lib/segment';
import { hasKey, useSettings } from '@/lib/store';
import { readBlocks } from '@/lib/docx/model';
import { IconInfo, IconUpload } from './icons';

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

  async function loadFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        setDocx(null);
        setText(await file.text());
        setTitle(file.name.replace(/\.[^.]+$/, ''));
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
    } catch {
      setError(he.errors.network);
    } finally {
      setBusy(false);
    }
  }

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
      if (f) loadFile(f);
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

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 md:py-10">
      <h1 className="mb-1 text-[22px] font-bold">{he.input.title}</h1>
      <p className="mb-5 text-muted">{he.tagline}</p>

      {mounted && !hasKey(settings) && (
        <div className="card mb-4 flex items-start gap-3 border-s-4 !border-s-warning p-3 text-[14px]">
          <IconInfo className="mt-0.5 shrink-0 text-warning" />
          <p>
            עדיין לא חיברת ספק מודל, אז הניתוח יתבסס על כללים מקומיים בלבד (בלי הסברים והצעות ניסוח).{' '}
            <Link href="/settings" className="font-semibold text-accent underline">
              לחיבור ספק בהגדרות
            </Link>
          </p>
        </div>
      )}

      <div className="card p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-4 font-semibold hover:border-accent"
            disabled={busy}
          >
            <IconUpload />
            {busy ? he.progress.reading : he.input.uploadButton}
          </button>
          <span className="hidden text-[13px] text-muted md:inline">{he.input.uploadHint}</span>
          <span className="text-[13px] text-muted">{he.input.supportedFormats}</span>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.docx,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFile(f);
              e.target.value = '';
            }}
          />
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת (לא חובה)"
          className="mb-2 w-full rounded-md border border-border bg-surface px-3 py-2 font-semibold"
          dir="auto"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={he.input.placeholder}
          dir="auto"
          rows={12}
          className="doc w-full resize-y rounded-md border border-border bg-surface px-3 py-2 !text-[17px]"
          aria-label="טקסט לניתוח"
        />

        <details className="mt-3">
          <summary className="cursor-pointer text-[14px] font-semibold text-muted">{he.input.contextLabel}</summary>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={he.input.contextPlaceholder}
            rows={2}
            dir="auto"
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-[14px]"
          />
        </details>

        {docx && (
          <p className={`mt-2 rounded-md px-3 py-2 text-[13px] ${docx.text === text ? 'bg-accent/10' : 'bg-surface-2 text-muted'}`}>
            {docx.text === text ? (
              <>
                קובץ Word: <strong dir="auto">{docx.name}</strong>. התוצאות יוצגו על המסמך המעוצב עצמו, ואפשר יהיה להוריד אותו אחרי עריכה.
              </>
            ) : (
              'שינית את הטקסט, ולכן הניתוח יוצג כטקסט רגיל ולא בתצוגת Word.'
            )}
          </p>
        )}
        {error && <p className="mt-3 text-[14px] text-danger" role="alert">{error}</p>}
        {tooShort && <p className="mt-3 text-[14px] text-muted">{he.errors.tooShort}</p>}
        {tooLong && <p className="mt-3 text-[14px] text-danger">{he.errors.tooLong.replace('{max}', MAX_WORDS.toLocaleString('he-IL'))}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={words < MIN_WORDS || tooLong || busy}
            onClick={() =>
              docx && docx.text === text ? onAnalyzeDocx(docx.bytes, docx.name, title, context) : onAnalyze(text, title, context)
            }
            className="min-h-11 rounded-md bg-accent px-6 font-bold text-accent-fg disabled:opacity-40"
          >
            {he.input.analyzeButton}
          </button>
          {!text && (
            <button type="button" onClick={() => setText(SAMPLE)} className="min-h-11 px-2 font-semibold text-accent underline-offset-4 hover:underline">
              {he.input.sampleButton}
            </button>
          )}
          {text && (
            <button type="button" onClick={() => { setText(''); setTitle(''); setDocx(null); }} className="min-h-11 px-2 text-muted hover:text-text">
              {he.input.clearButton}
            </button>
          )}
          <span className="ms-auto text-[13px] tabular-nums text-muted">{he.input.wordCount.replace('{count}', words.toLocaleString('he-IL'))}</span>
        </div>
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-muted">
        <strong>{he.disclaimer.title}:</strong> {he.disclaimer.body}
      </p>

      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-accent px-10 py-8 text-xl font-bold text-accent">שחררו כאן את הקובץ</div>
        </div>
      )}
    </div>
  );
}
