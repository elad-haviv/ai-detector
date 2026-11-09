import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { getLegal } from '@/lib/i18n/legal';
import { getLocale, pageTitle } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return pageTitle((t) => t.shell.privacy);
}

export default async function PrivacyPage() {
  return <LegalPage doc={getLegal(await getLocale()).privacy} />;
}
