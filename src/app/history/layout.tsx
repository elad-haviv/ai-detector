import type { Metadata } from 'next';
import { pageTitle } from '@/lib/i18n/server';

// The page itself is a client component, so its title lives here.
export async function generateMetadata(): Promise<Metadata> {
  return pageTitle((t) => t.history.pageTitle);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
