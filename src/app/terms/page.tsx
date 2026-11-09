import type { Metadata } from 'next';
import { StubPage } from '@/components/StubPage';
import { he } from '@/lib/i18n/he';

export const metadata: Metadata = { title: `${he.shell.terms} · ${he.appName}` };

export default function TermsPage() {
  return <StubPage title={he.shell.terms} intro={he.stub.termsIntro} />;
}
