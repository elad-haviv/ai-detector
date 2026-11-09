import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { getLegal } from '@/lib/i18n/legal';
import { getLocale, pageTitle } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return pageTitle((t) => t.shell.terms);
}

export default async function TermsPage() {
  return <LegalPage doc={getLegal(await getLocale()).terms} />;
}
