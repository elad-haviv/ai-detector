'use client';
import { useId, type ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
}

/**
 * Single choice built on native radios inside a <fieldset>: arrow keys, RTL order and screen-reader
 * semantics come from the browser. `variant="cards"` renders roomier radio cards with descriptions.
 */
export function SegmentedControl<T extends string>({
  legend,
  hint,
  value,
  options,
  onChange,
  name,
  variant = 'segmented',
  columns,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  name?: string;
  variant?: 'segmented' | 'cards';
  /** cards only: grid columns from sm up (default 2). */
  columns?: 2 | 3;
}) {
  const auto = useId().replace(/:/g, '');
  const group = name || `seg${auto}`;
  const hintId = hint ? `${group}-hint` : undefined;
  const cards = variant === 'cards';
  return (
    <fieldset aria-describedby={hintId}>
      <legend className="mb-1.5 text-caption font-semibold">{legend}</legend>
      <div
        className={
          cards
            ? `grid gap-2 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`
            : 'flex flex-wrap gap-1 rounded-lg border border-border-strong bg-surface-2 p-1'
        }
      >
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={
                cards
                  ? `seg-option flex cursor-pointer flex-col rounded-lg border p-3 text-start transition-colors ${
                      checked ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-border-strong hover:bg-surface-2'
                    }`
                  : `seg-option flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-center font-semibold transition-colors ${
                      checked ? 'bg-surface text-text shadow-sm ring-1 ring-accent' : 'text-muted hover:text-text'
                    }`
              }
            >
              <input type="radio" name={group} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              {cards ? (
                <>
                  <span className="flex items-center gap-2 font-bold">
                    <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-accent' : 'border-border-strong'}`}>
                      {checked && <span className="size-2 rounded-full bg-accent" />}
                    </span>
                    {o.label}
                  </span>
                  {o.description && <span className="mt-0.5 ps-6 text-caption text-muted">{o.description}</span>}
                </>
              ) : (
                o.label
              )}
            </label>
          );
        })}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </fieldset>
  );
}
