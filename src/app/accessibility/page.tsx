import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { he } from '@/lib/i18n/he';
import { accessibilityDoc } from '@/lib/i18n/legal.he';

export const metadata: Metadata = { title: `${he.shell.accessibility} · ${he.appName}` };

export default function AccessibilityPage() {
  return <LegalPage doc={accessibilityDoc} />;
}
