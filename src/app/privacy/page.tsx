import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { he } from '@/lib/i18n/he';
import { privacyDoc } from '@/lib/i18n/legal.he';

export const metadata: Metadata = { title: `${he.shell.privacy} · ${he.appName}` };

export default function PrivacyPage() {
  return <LegalPage doc={privacyDoc} />;
}
