import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';
import { he } from '@/lib/i18n/he';

export const metadata: Metadata = { title: `${he.notFound.title} · ${he.appName}` };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 md:py-12">
      <h1 className="text-title font-bold">{he.notFound.title}</h1>
      <p className="mt-2 text-muted">{he.notFound.body}</p>
      <ButtonLink href="/" variant="primary" className="mt-4">
        {he.notFound.backHome}
      </ButtonLink>
    </div>
  );
}
