'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getFile } from '@/lib/blobStore';
import { annotateRendered, buildEditedDocx } from '@/lib/docx/model';
import type { Sentence } from '@/lib/types';
import { useLangAttr, useT } from '@/lib/i18n/client';

export interface Decor {
  cls: string;
  badge?: { text: string; cls: string };
  label?: string;
}

/**
 * Renders the Word file with its own formatting (docx-preview) and overlays sentence highlights.
 * The preview is rebuilt from the edited .docx whenever sentence text changes, so what you see is
 * exactly what "download" produces.
 */
export function DocxView({
  fileKey,
  sentences,
  decor,
  selected,
  onSelect,
  onUnavailable,
}: {
  fileKey: string;
  sentences: Sentence[];
  decor: (id: number) => Decor;
  selected: number | null;
  onSelect: (id: number) => void;
  onUnavailable: () => void;
}) {
  const t = useT();
  const langAttr = useLangAttr();
  const hostRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const spansRef = useRef<Map<number, HTMLElement[]>>(new Map());
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mode, setMode] = useState<'page' | 'flow'>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'flow' : 'page'));
  const [renderTick, setRenderTick] = useState(0);

  const signature = useMemo(() => sentences.map((s) => `${s.id}:${s.paragraph}:${s.text}`).join('\u0001'), [sentences]);
  const sentencesRef = useRef(sentences);
  sentencesRef.current = sentences;

  // (Re)render the document when its text or the layout mode changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const original = await getFile(fileKey);
      if (!original) {
        if (!cancelled) onUnavailable();
        return;
      }
      try {
        const blob = await buildEditedDocx(original, sentencesRef.current);
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !hostRef.current) return;
        const host = hostRef.current;
        host.innerHTML = '';
        await renderAsync(blob, host, styleRef.current || undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: mode === 'flow',
          ignoreHeight: mode === 'flow',
          breakPages: mode === 'page',
          ignoreLastRenderedPageBreak: true,
          renderHeaders: mode === 'page',
          renderFooters: mode === 'page',
          renderFootnotes: true,
          renderComments: false,
          experimental: true,
          useBase64URL: true,
        });
        if (cancelled) return;
        spansRef.current = annotateRendered(host, sentencesRef.current);
        setState('ready');
        setRenderTick((t) => t + 1);
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey, signature, mode]);

  // Fit page width to the column in page mode
  useEffect(() => {
    const host = hostRef.current;
    if (!host || mode !== 'page') return;
    // zoom the renderer's wrapper (not the host) so measuring the host never feeds back
    const fit = () => {
      const wrapper = host.querySelector('.docx-wrapper') as HTMLElement | null;
      const page = host.querySelector('section.docx') as HTMLElement | null;
      if (!wrapper || !page) return;
      const pageW = page.offsetWidth + 32;
      wrapper.style.zoom = String(Math.min(1, host.clientWidth / pageW));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [mode, renderTick]);

  // Apply highlight classes, badges and selection without re-rendering the document
  useEffect(() => {
    const host = hostRef.current;
    if (!host || state !== 'ready') return;
    host.querySelectorAll('.badge[data-k]').forEach((b) => b.remove());
    // One roving tab stop: the selected sentence, else the first highlighted one, else the first.
    const ids = [...spansRef.current.keys()];
    const tabStop = selected !== null && spansRef.current.has(selected) ? selected : (ids.find((id) => decor(id).label) ?? ids[0]);
    for (const [id, spans] of spansRef.current) {
      const d = decor(id);
      spans.forEach((sp, i) => {
        sp.className = `sent ${d.cls}`;
        if (i === 0) {
          // A sentence can span several formatted runs; only the first is the button, so its name
          // is the whole sentence text (plus the band for highlighted ones).
          const text = sentencesRef.current.find((s) => s.id === id)?.text || sp.textContent || '';
          sp.setAttribute('role', 'button');
          sp.tabIndex = tabStop === id ? 0 : -1;
          sp.setAttribute('aria-label', d.label ? d.label.replace('{text}', text) : text);
        }
        if (selected === id) sp.setAttribute('aria-current', 'true');
        else sp.removeAttribute('aria-current');
      });
      if (d.badge) {
        const b = document.createElement('span');
        b.className = `badge ${d.badge.cls}`;
        b.dataset.k = '1';
        b.textContent = d.badge.text;
        b.contentEditable = 'false';
        spans[spans.length - 1].after(b);
      }
    }
  }, [decor, selected, state, renderTick]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-caption">
        <span className="text-muted">
          {t.docx.viewBefore}
          <span lang={langAttr('en')}>Word</span>
          {t.docx.viewAfter}
        </span>
        {(['page', 'flow'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`min-h-9 rounded-full border px-3 font-semibold ${mode === m ? 'border-accent bg-accent/10' : 'border-border-strong text-muted'}`}
          >
            {m === 'page' ? t.docx.pages : t.docx.flow}
          </button>
        ))}
        {state === 'loading' && <span className="ms-auto text-muted">{t.docx.loading}</span>}
      </div>
      {state === 'error' && <p className="card p-4 text-danger">{t.docx.error}</p>}
      <div ref={styleRef} />
      <div
        ref={hostRef}
        className={`docx-host ${mode}`}
        onClick={(e) => {
          const el = (e.target as HTMLElement).closest('[data-s]') as HTMLElement | null;
          if (el) onSelect(Number(el.dataset.s));
        }}
        onKeyDown={(e) => {
          const el = (e.target as HTMLElement).closest('[data-s]') as HTMLElement | null;
          if (el && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect(Number(el.dataset.s));
          }
        }}
      />
    </div>
  );
}
