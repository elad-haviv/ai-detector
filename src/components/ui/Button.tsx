'use client';
import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent hover:brightness-110',
  secondary: 'border border-border-strong bg-surface hover:bg-surface-2',
  ghost: 'hover:bg-surface-2',
  danger: 'bg-danger hover:brightness-110',
  link: 'underline underline-offset-4 hover:no-underline',
};
/** Default text colour per variant; skipped when className sets its own `text-<colour>`. */
const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: 'text-accent-fg',
  secondary: 'text-text',
  ghost: 'text-text',
  danger: 'text-danger-fg',
  link: 'text-accent',
};
const OWN_COLOUR = /(^|\s)text-(text|muted|accent|accent-fg|danger|danger-fg|success|warning)(\s|$)/;
const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 gap-2',
  lg: 'min-h-12 px-6 text-h2 gap-2',
};
const ICON_SIZE: Record<ButtonSize, string> = { sm: 'size-9', md: 'size-11', lg: 'size-12' };

/** Class string for anything that should look like a button (e.g. a Link). */
export function buttonClass({ variant = 'secondary', size = 'md', iconOnly = false, className = '' }: { variant?: ButtonVariant; size?: ButtonSize; iconOnly?: boolean; className?: string } = {}) {
  return [
    'inline-flex shrink-0 items-center justify-center rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45',
    VARIANT[variant],
    OWN_COLOUR.test(className) ? '' : VARIANT_TEXT[variant],
    variant === 'link' ? 'min-h-11 px-1' : iconOnly ? ICON_SIZE[size] : SIZE[size],
    className,
  ].join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon (decorative). */
  icon?: ReactNode;
  /** Square icon-only button: pass `aria-label`. */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconOnly, className = '', type = 'button', children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass({ variant, size, iconOnly, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
