'use client';
import { he } from '@/lib/i18n/he';

export type Band = 0 | 1 | 2 | 3;
export function bandOf(p: number, threshold: number): Band {
  if (p < threshold) return 0;
  if (p < 60) return 1;
  if (p < 80) return 2;
  return 3;
}
export const BAND_LABEL: Record<Band, string> = { 0: 'מתחת לסף', 1: 'אפשרי', 2: 'סביר', 3: 'סביר מאוד' };

export function scoreBand(p: number) {
  const key = p < 20 ? '0-20' : p < 40 ? '20-40' : p < 60 ? '40-60' : p < 80 ? '60-80' : '80-100';
  return he.results.scoreBands[key];
}
export const CONFIDENCE_LABEL = { low: 'ביטחון נמוך', medium: 'ביטחון בינוני', high: 'ביטחון גבוה' } as const;

export function ScoreRing({ value, size = 96, stroke = 8, pending }: { value: number; size?: number; stroke?: number; pending?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? 'var(--hl-3-line)' : value >= 60 ? 'var(--hl-2-line)' : value >= 40 ? 'var(--hl-1-line)' : 'var(--success)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}%`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 400ms ease' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="var(--text)"
        style={{ fontSize: size * 0.3, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
      >
        {pending ? '—' : `${value}%`}
      </text>
    </svg>
  );
}

export function BandLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text">
      {([1, 2, 3] as Band[]).map((b) => (
        <li key={b} className="flex items-center gap-1">
          <span aria-hidden className={`sent b${b} !cursor-default px-1`}>
            אבג
          </span>
          {BAND_LABEL[b]}
        </li>
      ))}
    </ul>
  );
}
