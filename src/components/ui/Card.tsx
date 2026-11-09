import type { HTMLAttributes, ReactNode } from 'react';

const PAD = { none: '', sm: 'p-3', md: 'p-4 md:p-5', lg: 'p-5 md:p-8' } as const;

export function Card({ padding = 'md', className = '', ...rest }: HTMLAttributes<HTMLDivElement> & { padding?: keyof typeof PAD }) {
  return <div className={`card ${PAD[padding]} ${className}`} {...rest} />;
}

/**
 * A titled settings/page section: <section aria-labelledby> with an h2 and optional intro.
 * `id` becomes the in-page anchor.
 */
export function Section({ id, title, intro, children, className = '' }: { id: string; title: ReactNode; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`card scroll-mt-32 space-y-5 p-4 md:p-6 ${className}`}>
      <header>
        <h2 id={`${id}-title`} className="text-h2 font-bold">
          {title}
        </h2>
        {intro && <p className="mt-0.5 text-sm text-muted">{intro}</p>}
      </header>
      {children}
    </section>
  );
}
