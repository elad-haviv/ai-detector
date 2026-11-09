import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { he } from '@/lib/i18n/he';
import { termsDoc } from '@/lib/i18n/legal.he';

export const metadata: Metadata = { title: `${he.shell.terms} · ${he.appName}` };

export default function TermsPage() {
  return <LegalPage doc={termsDoc} />;
}
