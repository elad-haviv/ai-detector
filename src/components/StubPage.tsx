import { he } from '@/lib/i18n/he';
import { ButtonLink } from './ui/Button';

/** Placeholder for pages whose content arrives in a later milestone (privacy, terms, accessibility). */
export function StubPage({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 md:py-12">
      <h1 className="text-title font-bold">{title}</h1>
      <div className="card mt-4 space-y-3 p-5 md:p-6">
        <p>{intro}</p>
        <p className="text-muted">{he.stub.comingSoon}</p>
        <ButtonLink href="/" variant="secondary">
          {he.stub.backHome}
        </ButtonLink>
      </div>
    </div>
  );
}
