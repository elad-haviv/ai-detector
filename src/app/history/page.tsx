'use client';
import Link from 'next/link';
import { useState } from 'react';
import { he } from '@/lib/i18n/he';
import { useHistory } from '@/lib/store';
import { ScoreRing } from '@/components/results/shared';

export default function HistoryPage() {
  const { items, remove, clear } = useHistory();
  const [q, setQ] = useState('');
  const shown = items.filter((a) => !q || a.title.includes(q) || a.sentences.some((s) => s.text.includes(q)));

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 md:py-10">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-[22px] font-bold">{he.history.title}</h1>
        {items.length > 0 && (
          <button onClick={() => confirm(he.history.clearAllConfirm) && clear()} className="ms-auto text-[14px] text-muted underline">
            {he.history.clearAll}
          </button>
        )}
      </div>
      {items.length > 0 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש" className="mb-4 min-h-11 w-full rounded-md border border-border bg-surface px-3" />
      )}
      {items.length === 0 ? (
        <div className="card p-8 text-center text-muted">{he.empty.history}</div>
      ) : (
        <ul className="space-y-2">
          {shown.map((a) => (
            <li key={a.id} className="card flex items-center gap-3 p-3">
              <ScoreRing value={a.overall.probability} size={44} stroke={4} />
              <Link href={`/?id=${a.id}`} className="min-w-0 flex-1">
                <div dir="auto" className="truncate font-bold">{a.title}</div>
                <div className="text-[13px] text-muted">
                  {he.history.analyzedOn.replace('{date}', new Date(a.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }))} ·{' '}
                  {a.stats.words.toLocaleString('he-IL')} מילים{a.meta.model ? '' : ' · מקומי'}
                </div>
              </Link>
              <button onClick={() => confirm(he.history.deleteConfirm) && remove(a.id)} className="min-h-10 rounded-md px-3 text-[14px] text-muted hover:text-danger">
                {he.history.delete}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[12px] text-muted">{he.history.storedLocally}</p>
    </div>
  );
}
