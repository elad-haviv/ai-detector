'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { intlLocale } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/client';
import { useHistory } from '@/lib/store';
import type { Analysis } from '@/lib/types';
import { ScoreRing } from '@/components/results/shared';
import { IconHistory, IconSearch, IconTrash } from '@/components/icons';
import { Button, ButtonLink, ConfirmDialog, Field, Input, useToast } from '@/components/ui';

export default function HistoryPage() {
  const t = useT();
  const locale = intlLocale(useLocale());
  const { items, remove, clear } = useHistory();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [toDelete, setToDelete] = useState<Analysis | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const query = q.trim();
  const shown = items.filter((a) => !query || a.title.includes(query) || a.sentences.some((s) => s.text.includes(query)));
  const fmt = (n: number) => n.toLocaleString(locale);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // After a delete, focus the next item (or the previous one, or the heading when the list is empty).
  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    // next frame: after the confirm dialog has closed and tried to restore focus to the removed button
    requestAnimationFrame(() => {
      const el = target === 'heading' ? headingRef.current : document.querySelector<HTMLElement>(`[data-history-link="${CSS.escape(target)}"]`);
      (el || headingRef.current)?.focus();
    });
  }, [items]);

  return (
    <div className="mx-auto max-w-[800px] px-4 py-6 md:py-10">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 ref={headingRef} tabIndex={-1} className="text-title font-bold">
          {t.history.title}
        </h1>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" icon={<IconTrash width={16} height={16} />} onClick={() => setConfirmClear(true)} className="ms-auto text-danger">
            {t.history.clearAll}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span aria-hidden className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted">
            <IconHistory width={28} height={28} />
          </span>
          <p className="max-w-sm text-muted">{t.empty.history}</p>
          <ButtonLink href="/" variant="primary">
            {t.history.startFirst}
          </ButtonLink>
        </div>
      ) : (
        <>
          <div role="search" className="mb-4">
            <Field label={t.history.search} hint={t.history.searchHint}>
              {(p) => (
                <div className="relative">
                  <IconSearch aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} className="ps-10" dir="auto" />
                </div>
              )}
            </Field>
          </div>
          <p className="mb-2 text-caption text-muted" role="status">
            {query && shown.length === 0 ? t.history.noMatches.replace('{q}', query) : shown.length === 1 ? t.history.resultsOne : t.history.resultsCount.replace('{count}', fmt(shown.length))}
          </p>
          <ul className="space-y-2">
            {shown.map((a) => (
              <li key={a.id} className="card flex items-center gap-3 p-2 ps-3 transition-colors hover:border-border-strong">
                <ScoreRing value={a.overall.probability} size={44} stroke={4} />
                <Link href={`/?id=${a.id}`} data-history-link={a.id} className="min-w-0 flex-1 rounded-md py-1">
                  <div dir="auto" className="truncate font-bold">
                    {a.title}
                  </div>
                  <div className="text-caption text-muted">
                    {t.history.analyzedOn.replace('{date}', new Date(a.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }))} ·{' '}
                    {t.history.words.replace('{count}', fmt(a.stats.words))}
                    {a.meta.model ? '' : ` · ${t.history.local}`}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={t.history.deleteItem.replace('{title}', a.title)}
                  title={t.history.delete}
                  onClick={() => setToDelete(a)}
                  className="text-muted hover:text-danger"
                >
                  <IconTrash />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 text-xs text-muted">{t.history.storedLocally}</p>

      <ConfirmDialog
        open={!!toDelete}
        title={t.history.deleteTitle}
        body={
          <>
            <span dir="auto" className="font-semibold text-text">
              {toDelete?.title}
            </span>
            <br />
            {t.history.deleteConfirm}
          </>
        }
        confirmLabel={t.history.delete}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            const i = shown.findIndex((a) => a.id === toDelete.id);
            focusAfter.current = (shown[i + 1] || shown[i - 1])?.id ?? 'heading';
            remove(toDelete.id);
            toast(t.history.deleted.replace('{title}', toDelete.title), { tone: 'success' });
          }
          setToDelete(null);
        }}
      />
      <ConfirmDialog
        open={confirmClear}
        title={t.history.clearAllTitle}
        body={t.history.clearAllConfirm}
        confirmLabel={t.history.clearAll}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          focusAfter.current = 'heading';
          clear();
          setConfirmClear(false);
          toast(t.history.cleared, { tone: 'success' });
        }}
      />
    </div>
  );
}
