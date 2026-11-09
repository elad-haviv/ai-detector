import type { Metadata } from 'next';
import { he } from '@/lib/i18n/he';

// The page itself is a client component, so its title lives here.
export const metadata: Metadata = { title: `${he.history.pageTitle} · ${he.appName}` };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
