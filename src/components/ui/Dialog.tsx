'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { he } from '@/lib/i18n/he';
import { IconX } from '../icons';
import { Button } from './Button';

/**
 * Modal dialog on native <dialog>.showModal(): the browser makes the page behind inert (focus
 * stays inside), Esc closes. We restore focus to whatever opened it, and a click on the backdrop
 * closes. `variant`: "center" (default), "sheet" (bottom sheet on mobile, centred from md up),
 * "full" (full screen). Children render only while open.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'center',
  className = '',
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action row, rendered at the end (logical end = left in RTL). */
  footer?: ReactNode;
  variant?: 'center' | 'sheet' | 'full';
  className?: string;
  /** CSS selector inside the dialog to focus on open (default: first focusable, i.e. close button). */
  initialFocus?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      d.showModal();
      if (initialFocus) d.querySelector<HTMLElement>(initialFocus)?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, initialFocus]);

  // Return focus after close (also on unmount while open)
  useEffect(() => {
    if (open) return;
    const el = returnTo.current;
    returnTo.current = null;
    if (el && document.contains(el)) el.focus({ preventScroll: true });
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${uid}-t`}
      aria-describedby={description ? `${uid}-d` : undefined}
      className={`ui-dialog ${variant === 'center' ? '' : variant} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-start gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0 flex-1 pt-1.5">
              <h2 id={`${uid}-t`} className="text-h2 font-bold">
                {title}
              </h2>
              {description && (
                <p id={`${uid}-d`} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" iconOnly aria-label={he.ui.close} onClick={() => onCloseRef.current()} className="-me-2">
              <IconX />
            </Button>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="pb-safe flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Yes/no confirmation. The cancel button gets initial focus so Enter never destroys by accident. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = he.ui.cancel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={body}
      className="!max-w-[min(28rem,calc(100vw-2rem))]"
      initialFocus="[data-autofocus]"
      footer={
        <>
          <Button data-autofocus onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
