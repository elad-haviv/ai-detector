import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getT } from '@/lib/i18n/server';
import { Workspace } from '@/components/Workspace';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).input.pageTitle };
}

export default function Home() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
