'use client';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/** Props a Field hands to its control so label, hint and error are wired for assistive tech. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

/**
 * Label + control + hint + error. The control is rendered by `children(props)`; spread the props
 * onto the input so `<label for>`, `aria-describedby` (hint + error) and `aria-invalid` line up.
 */
export function Field({
  label,
  hint,
  error,
  id: idProp,
  className = '',
  labelAside,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  className?: string;
  /** Extra content on the label row (e.g. a counter or a link). */
  labelAside?: ReactNode;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const auto = useId();
  const id = idProp || `f${auto.replace(/:/g, '')}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline gap-2">
        <label htmlFor={id} className="text-caption font-semibold">
          {label}
        </label>
        {labelAside && <div className="ms-auto">{labelAside}</div>}
      </div>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`control ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`control resize-y ${className}`} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', ...rest }, ref) {
  return <select ref={ref} className={`control ${className}`} {...rest} />;
});

/** Checkbox with its label (and optional hint) as one large click target. */
export function Checkbox({
  label,
  hint,
  checked,
  onChange,
  id: idProp,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  const auto = useId();
  const id = idProp || `c${auto.replace(/:/g, '')}`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="size-6 shrink-0 accent-[var(--accent)]"
      />
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
