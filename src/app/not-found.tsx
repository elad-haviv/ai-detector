import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';
import { getT, pageTitle } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return pageTitle((t) => t.notFound.title);
}

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 md:py-12">
      <h1 className="text-title font-bold">{t.notFound.title}</h1>
      <p className="mt-2 text-muted">{t.notFound.body}</p>
      <ButtonLink href="/" variant="primary" className="mt-4">
        {t.notFound.backHome}
      </ButtonLink>
    </div>
  );
}
