import type { Metadata } from 'next';
import { Suspense } from 'react';
import { he } from '@/lib/i18n/he';
import { Workspace } from '@/components/Workspace';

export const metadata: Metadata = { title: he.input.pageTitle };

export default function Home() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
